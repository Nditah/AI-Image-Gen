from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone

from .database import database
from .security import enum_value

PROVIDERS = (
    "openai",
    "stability",
    "huggingface",
)

TAG_LABELS = {
    "accurate": "Accurate",
    "creative": "Creative",
    "not_what_i_asked": "Not what I asked",
    "low_quality": "Low quality",
    "felt_unsafe": "Felt unsafe",
    "overblocked": "Over-blocked",
    "slow": "Slow",
    "provider_issue": "Provider issue",
}


def parse_day_bound(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if "T" in text:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    else:
        day = date.fromisoformat(text)
        dt = datetime.combine(day, time.max if end_of_day else time.min)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def resolve_analytics_window(
    *,
    days: int | None,
    date_from: str | None,
    date_to: str | None,
) -> tuple[datetime | None, datetime | None, str]:
    """Return (start, end, label). None start means unbounded history."""
    start = parse_day_bound(date_from, end_of_day=False)
    end = parse_day_bound(date_to, end_of_day=True)
    now = datetime.now(timezone.utc)

    if start or end:
        if end is None:
            end = now
        if start and end and start > end:
            start, end = end, start
        label = f"{(start or end).date().isoformat()} → {end.date().isoformat()}"
        return start, end, label

    span = days if days and days > 0 else 30
    if span >= 3650:
        return None, now, "All time"
    start = now - timedelta(days=span)
    return start, now, f"Last {span} days"


def _created_at_filter(start: datetime | None, end: datetime | None) -> dict:
    created: dict = {}
    if start is not None:
        created["gte"] = start
    if end is not None:
        created["lte"] = end
    return {"createdAt": created} if created else {}


def _percentile(sorted_values: list[int], pct: float) -> int | None:
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * pct
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    weight = rank - low
    return int(round(sorted_values[low] * (1 - weight) + sorted_values[high] * weight))


async def build_admin_analytics(
    *,
    days: int | None = 30,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    start, end, range_label = resolve_analytics_window(days=days, date_from=date_from, date_to=date_to)
    where = _created_at_filter(start, end)

    logs = await database.client.promptlog.find_many(
        where=where,
        include={"feedback": True},
        order={"createdAt": "asc"},
    )

    provider_counts: Counter[str] = Counter()
    provider_feedback: dict[str, dict[str, int]] = defaultdict(lambda: {"up": 0, "down": 0, "rated": 0})
    provider_durations: dict[str, list[int]] = defaultdict(list)
    tag_counts: Counter[str] = Counter()
    daily_counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    overall_up = 0
    overall_down = 0
    all_durations: list[int] = []

    for log in logs:
        provider = (log.provider or "unknown").lower()
        provider_counts[provider] += 1
        safety_counts[enum_value(log.safetyStatus) or "UNKNOWN"] += 1
        if log.createdAt:
            daily_counts[log.createdAt.astimezone(timezone.utc).date().isoformat()] += 1

        duration = getattr(log, "durationMs", None)
        if isinstance(duration, int) and duration >= 0:
            provider_durations[provider].append(duration)
            all_durations.append(duration)

        feedback = getattr(log, "feedback", None)
        if feedback is None:
            continue
        verdict = enum_value(feedback.verdict)
        provider_feedback[provider]["rated"] += 1
        if verdict == "UP":
            provider_feedback[provider]["up"] += 1
            overall_up += 1
        elif verdict == "DOWN":
            provider_feedback[provider]["down"] += 1
            overall_down += 1
        for tag in feedback.tags or []:
            tag_counts[str(tag)] += 1

    provider_usage = [
        {"provider": name, "count": provider_counts.get(name, 0)}
        for name in PROVIDERS
        if provider_counts.get(name, 0)
    ]
    for name, count in provider_counts.items():
        if name not in PROVIDERS:
            provider_usage.append({"provider": name, "count": count})
    provider_usage.sort(key=lambda item: item["count"], reverse=True)

    satisfaction_by_provider = []
    for name in sorted({*PROVIDERS, *provider_feedback.keys()}):
        stats = provider_feedback.get(name) or {"up": 0, "down": 0, "rated": 0}
        if stats["rated"] == 0 and provider_counts.get(name, 0) == 0:
            continue
        rated = stats["rated"]
        satisfaction_by_provider.append(
            {
                "provider": name,
                "generations": provider_counts.get(name, 0),
                "rated": rated,
                "up": stats["up"],
                "down": stats["down"],
                "satisfactionRate": round((stats["up"] / rated) * 100, 1) if rated else None,
            }
        )
    satisfaction_by_provider.sort(key=lambda item: item["generations"], reverse=True)

    latency_by_provider = []
    for name, values in provider_durations.items():
        ordered = sorted(values)
        latency_by_provider.append(
            {
                "provider": name,
                "samples": len(ordered),
                "avgMs": int(round(sum(ordered) / len(ordered))),
                "minMs": ordered[0],
                "maxMs": ordered[-1],
                "p50Ms": _percentile(ordered, 0.5),
                "p95Ms": _percentile(ordered, 0.95),
            }
        )
    latency_by_provider.sort(key=lambda item: item["avgMs"], reverse=True)

    feedback_tags = [
        {"tag": tag, "label": TAG_LABELS.get(tag, tag.replace("_", " ").title()), "count": count}
        for tag, count in tag_counts.most_common()
    ]

    # Fill missing days in the window for a continuous bar/line series.
    daily = []
    if start is not None and end is not None:
        cursor = start.astimezone(timezone.utc).date()
        last = end.astimezone(timezone.utc).date()
        while cursor <= last:
            key = cursor.isoformat()
            daily.append({"date": key, "count": daily_counts.get(key, 0)})
            cursor += timedelta(days=1)
    else:
        daily = [{"date": day, "count": count} for day, count in sorted(daily_counts.items())]

    rated_total = overall_up + overall_down
    timed = sorted(all_durations)
    return {
        "range": {
            "label": range_label,
            "from": start.isoformat() if start else None,
            "to": end.isoformat() if end else None,
            "days": days,
        },
        "summary": {
            "generations": len(logs),
            "rated": rated_total,
            "up": overall_up,
            "down": overall_down,
            "satisfactionRate": round((overall_up / rated_total) * 100, 1) if rated_total else None,
            "unrated": max(len(logs) - rated_total, 0),
            "timedGenerations": len(timed),
            "avgDurationMs": int(round(sum(timed) / len(timed))) if timed else None,
            "p50DurationMs": _percentile(timed, 0.5),
            "p95DurationMs": _percentile(timed, 0.95),
        },
        "providerUsage": provider_usage,
        "satisfactionByProvider": satisfaction_by_provider,
        "latencyByProvider": latency_by_provider,
        "feedbackTags": feedback_tags,
        "dailyGenerations": daily,
        "safetyBreakdown": [
            {"status": status, "count": count} for status, count in safety_counts.most_common()
        ],
        "satisfactionPie": [
            {"label": "Thumbs up", "key": "UP", "count": overall_up},
            {"label": "Thumbs down", "key": "DOWN", "count": overall_down},
        ],
    }
