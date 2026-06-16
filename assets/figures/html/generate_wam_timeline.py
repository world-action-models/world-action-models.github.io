#!/usr/bin/env python3
"""Generate the Section 3 WAM philosophy timeline as editable HTML/SVG."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from pathlib import Path


OUT = Path(__file__).with_name("fig-wam-timeline.html")
W, H = 1600, 900

MAX_WORKS_PER_BLOCK = 5
RENDER_SAFE_BOTTOM = 805

BANNED_LABELS = {
    "A-JEPA",
    "AdaWorld",
    "AnimateDiff",
    "Being-H0.7",
    "CogVideoX",
    "Cosmos-Predict2",
    "Cosmos-Transfer1",
    "Drive-JEPA",
    "DreamerV3",
    "I-JEPA",
    "InteractiveWorldSimulator",
    "JEPA-VLA",
    "Key-Gram",
    "LAPA",
    "Latte",
    "MC-JEPA",
    "MoCoGAN",
    "NOVA",
    "OpenVLA",
    "PlaNet",
    "RLA-WM",
    "RoboDreamer",
    "RoboScape",
    "RoboScape-R",
    "SANTS",
    "Sora",
    "Sora_2",
    "TransDreamer",
    "UnifiedVLA",
    "V-JEPA",
    "VLA-JEPA",
    "VideoPoet",
    "Wan",
    "villa-X",
    "pi_0",
    "pi0",
}

DISPLAY_PERIOD_LABELS = {
    "Jan 26": "2026 Jan",
    "Feb 26": "2026 Feb",
    "Mar 26": "2026 Mar",
    "Apr-May 26": "2026 Apr-May",
}

COLORS = {
    "render": {
        "fill": "#dcecff",
        "stroke": "#5aa5df",
        "text": "#17334f",
        "legend": "Render-and-Decode",
        "short": "pixel future",
    },
    "latent": {
        "fill": "#ddf3dc",
        "stroke": "#58b667",
        "text": "#1e4c2a",
        "legend": "Latent-Only",
        "short": "latent or feature future",
    },
    "genfree": {
        "fill": "#e8ddfb",
        "stroke": "#8a70c8",
        "text": "#352a64",
        "legend": "Generation-Free",
        "short": "no video generator",
    },
}


@dataclass(frozen=True)
class TimelineBlock:
    kind: str
    lines: tuple[str, ...]


@dataclass(frozen=True)
class Period:
    label: str
    x: int
    y: int
    direction: str
    blocks: tuple[TimelineBlock, ...]


@dataclass(frozen=True)
class PlacedBlock:
    period: str
    kind: str
    lines: tuple[str, ...]
    x: int
    y: int
    w: int
    h: int
    font_size: int


PERIODS = [
    Period(
        "2023",
        120,
        645,
        "down",
        (
            TimelineBlock("render", ("UniPi", "VLP, AVDC, GR-1")),
        ),
    ),
    Period(
        "2024",
        300,
        510,
        "up",
        (
            TimelineBlock("render", ("Dreamitate", "This&That", "GR-MG", "Gen2Act", "GR-2")),
            TimelineBlock("latent", ("ARDuP", "Im2Flow2Act", "VPP")),
        ),
    ),
    Period(
        "2025 H1",
        490,
        485,
        "down",
        (
            TimelineBlock("render", ("CoT-VLA", "TesserAct", "DreamGen, WorldVLA")),
            TimelineBlock("latent", ("VILP", "UVA")),
            TimelineBlock("genfree", ("FLARE",)),
        ),
    ),
    Period(
        "2025 Q3",
        685,
        410,
        "up",
        (
            TimelineBlock("render", ("Vidar, 4DGen", "RIGVid, F1")),
            TimelineBlock("latent", ("Video Policy", "Genie Envisioner", "3D-FDP")),
        ),
    ),
    Period(
        "2025 Q4",
        855,
        365,
        "down",
        (
            TimelineBlock("render", ("NovaFlow", "RynnVLA-002", "UD-VLA", "Dream2Flow", "LVP")),
            TimelineBlock("latent", ("TraceGen", "mimic-video", "Act2Goal")),
            TimelineBlock("genfree", ("DUST", "Audio-WM", "HiF-VLA", "DexWM")),
        ),
    ),
    Period(
        "Jan 26",
        1020,
        350,
        "up",
        (
            TimelineBlock("render", ("TC-IDM",)),
            TimelineBlock("latent", ("CosmosPolicy", "LingBot-VA")),
            TimelineBlock("genfree", ("PointWorld", "PALM")),
        ),
    ),
    Period(
        "Feb 26",
        1180,
        330,
        "down",
        (
            TimelineBlock("render", ("BagelVLA", "MVISTA-4D")),
            TimelineBlock("render", ("Say-Dream-Act", "Dex4D", "DreamZero", "NovaPlan")),
            TimelineBlock("latent", ("GigaBrain-0.5M*", "AdaWorldPolicy")),
            TimelineBlock("genfree", ("LDA-1B", "FRAPPE")),
        ),
    ),
    Period(
        "Mar 26",
        1340,
        310,
        "up",
        (
            TimelineBlock("render", ("PhysGen", "EmboAlign")),
            TimelineBlock("latent", ("DiT4DiT", "S-VAM")),
            TimelineBlock("genfree", ("ICLR-VR",)),
        ),
    ),
    Period(
        "Apr-May 26",
        1500,
        190,
        "down",
        (
            TimelineBlock("render", ("Veo-Act", "VAG", "pi_0.7", "X-WAM")),
            TimelineBlock("render", ("CKT-WAM", "NoiseGate", "HarmoWAM", "DriveWAM")),
            TimelineBlock("latent", ("AIM", "WAV", "MWM", "MotuBrain")),
            TimelineBlock("latent", ("FFDC-WAM", "DAWN", "RoboFlow4D")),
            TimelineBlock("genfree", ("ALAM",)),
        ),
    ),
]


def text_width(text: str, size: int) -> float:
    width = 0.0
    for ch in text:
        if ch in " .,:'-/()_":
            width += size * 0.34
        elif ch == "&":
            width += size * 0.62
        elif ch.isdigit():
            width += size * 0.54
        elif ch.isupper():
            width += size * 0.62
        else:
            width += size * 0.50
    return width


def block_font(lines: tuple[str, ...]) -> int:
    widest = max(text_width(line, 18) for line in lines)
    if widest > 138:
        return 16
    if widest > 124 or len(lines) >= 4:
        return 17
    return 18


def block_size(lines: tuple[str, ...], size: int) -> tuple[int, int]:
    max_line = max(text_width(line, size) for line in lines)
    width = int(max(74, max_line + 34))
    height = int(len(lines) * (size + 5) + 20)
    return width, height


def measured_block(block: TimelineBlock) -> tuple[int, int, int]:
    size = block_font(block.lines)
    width, height = block_size(block.lines, size)
    return width, height, size


def placed_blocks() -> list[PlacedBlock]:
    placed: list[PlacedBlock] = []
    for period in PERIODS:
        measured = [(block, *measured_block(block)) for block in period.blocks]
        if period.direction == "up":
            measured.sort(key=lambda item: (-item[1], -item[2], item[0].kind))
            cursor = period.y - 84
            for block, width, height, size in measured:
                y = cursor - height
                placed.append(
                    PlacedBlock(
                        period=period.label,
                        kind=block.kind,
                        lines=block.lines,
                        x=int(period.x - width / 2),
                        y=y,
                        w=width,
                        h=height,
                        font_size=size,
                    )
                )
                cursor = y - 11
        elif period.direction == "down":
            measured.sort(key=lambda item: (item[1], item[2], item[0].kind))
            y = period.y + 84
            for block, width, height, size in measured:
                placed.append(
                    PlacedBlock(
                        period=period.label,
                        kind=block.kind,
                        lines=block.lines,
                        x=int(period.x - width / 2),
                        y=y,
                        w=width,
                        h=height,
                        font_size=size,
                    )
                )
                y += height + 11
        else:
            raise ValueError(f"unknown stack direction for {period.label}: {period.direction}")
    return placed


def rough_box_path(x: int, y: int, w: int, h: int, d: int = 4) -> str:
    x2 = x + w
    y2 = y + h
    return (
        f"M {x + 10} {y + d} "
        f"C {x + 42} {y - 2} {x2 - 43} {y + 2} {x2 - 10} {y + d} "
        f"Q {x2 + d} {y + 8} {x2 - 2} {y + 22} "
        f"L {x2 - d} {y2 - 12} "
        f"Q {x2 - 1} {y2 + d} {x2 - 16} {y2 - 1} "
        f"C {x2 - 58} {y2 + 3} {x + 54} {y2 + 2} {x + 12} {y2 - 1} "
        f"Q {x - d} {y2 - 8} {x + 2} {y2 - 24} "
        f"L {x + d} {y + 18} "
        f"Q {x - 1} {y + 6} {x + 10} {y + d} Z"
    )


def label_lines(lines: tuple[str, ...], x: int, y: int, w: int, h: int, color: str, size: int) -> str:
    line_gap = size + 5
    start_y = y + h / 2 - (len(lines) - 1) * line_gap / 2 + size * 0.35
    out = []
    for i, line in enumerate(lines):
        out.append(
            f'<text x="{x + w / 2:.1f}" y="{start_y + i * line_gap:.1f}" '
            f'text-anchor="middle" class="timeline-label" style="font-size:{size}px;fill:{color}">{escape(line)}</text>'
        )
    return "\n".join(out)


def block_svg(block: PlacedBlock) -> str:
    c = COLORS[block.kind]
    path = rough_box_path(block.x, block.y, block.w, block.h)
    return (
        f'<g class="paper-block {block.kind}" data-period="{escape(block.period)}">\n'
        f'  <path d="{path}" fill="{c["fill"]}" stroke="{c["stroke"]}" stroke-width="4" opacity="0.96"/>\n'
        f'  {label_lines(block.lines, block.x, block.y, block.w, block.h, c["text"], block.font_size)}\n'
        f'</g>'
    )


def date_display(period: Period) -> tuple[str, int]:
    label = DISPLAY_PERIOD_LABELS.get(period.label, period.label)
    size = 21 if len(label) <= 8 else 18
    return label, size


def date_rect(period: Period) -> tuple[int, int, int, int]:
    display_label, size = date_display(period)
    width = int(text_width(display_label, size) + 34)
    height = 38
    cx = period.x
    cy = period.y + 29 if period.direction == "up" else period.y - 29
    return int(cx - width / 2), int(cy - height / 2), width, height


def date_chip(period: Period) -> str:
    x, y, w, h = date_rect(period)
    display_label, size = date_display(period)
    path = rough_box_path(x, y, w, h, 3)
    return (
        f'<g class="date-chip">\n'
        f'  <path d="{path}" fill="#dc9290" stroke="#dc9290" stroke-width="3"/>\n'
        f'  <text x="{x + w / 2:.1f}" y="{y + h / 2 + size * 0.34:.1f}" text-anchor="middle" '
        f'class="date-label" style="font-size:{size}px">{escape(display_label)}</text>\n'
        f'</g>'
    )


def stem_svg(period: Period, first_block: PlacedBlock) -> str:
    if period.direction == "up":
        stem_top = first_block.y + first_block.h + 9
        stem_bottom = period.y - 18
        ring_y = period.y - 53
    else:
        stem_top = period.y + 18
        stem_bottom = first_block.y - 9
        ring_y = period.y + 53
    return (
        f'<line x1="{period.x}" y1="{stem_top}" x2="{period.x}" y2="{stem_bottom}" class="time-stem"/>\n'
        f'<circle cx="{period.x}" cy="{ring_y}" r="13" class="time-ring"/>\n'
        f'{date_chip(period)}'
    )


def legend_rect() -> tuple[int, int, int, int]:
    return 58, 42, 760, 88


def legend_svg() -> str:
    x, y, w, h = legend_rect()
    path = rough_box_path(x, y, w, h, 5)
    offsets = [34, 292, 532]
    items = []
    for kind, offset in zip(["render", "latent", "genfree"], offsets):
        c = COLORS[kind]
        sw, sh = 42, 28
        sx, sy = x + offset, y + 22
        items.append(
            f'<path d="{rough_box_path(sx, sy, sw, sh, 3)}" fill="{c["fill"]}" stroke="{c["stroke"]}" stroke-width="4"/>\n'
            f'<text x="{sx + sw + 18}" y="{y + 30}" class="legend-title">{c["legend"]}</text>\n'
            f'<text x="{sx + sw + 18}" y="{y + 55}" class="legend-sub">{c["short"]}</text>'
        )
    return (
        f'<g class="legend">\n'
        f'  <path d="{path}" fill="#fff3ee" stroke="#d98982" stroke-width="4"/>\n'
        f'  {"".join(items)}\n'
        f'</g>'
    )


def stream_path() -> str:
    return (
        "M 120 645 "
        "C 165 625 218 552 300 510 "
        "C 372 475 425 500 490 485 "
        "C 565 466 613 445 685 410 "
        "C 750 378 793 374 855 365 "
        "C 920 354 962 349 1020 350 "
        "C 1082 351 1126 344 1180 330 "
        "C 1246 312 1287 330 1340 310 "
        "C 1410 283 1458 255 1500 190"
    )


def padded(rect: tuple[int, int, int, int], pad: int) -> tuple[int, int, int, int]:
    x, y, w, h = rect
    return x - pad, y - pad, w + 2 * pad, h + 2 * pad


def overlaps(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def method_names(lines: tuple[str, ...]) -> list[str]:
    return [part.strip() for line in lines for part in line.split(",") if part.strip()]


def count_methods() -> dict[str, int]:
    counts = dict.fromkeys(COLORS, 0)
    for period in PERIODS:
        for block in period.blocks:
            counts[block.kind] += len(method_names(block.lines))
    return counts


def validate_layout(blocks: list[PlacedBlock]) -> None:
    boxes: list[tuple[str, tuple[int, int, int, int]]] = [
        ("legend", legend_rect()),
    ]
    for block in blocks:
        boxes.append((f"block:{block.period}:{'/'.join(block.lines)}", (block.x, block.y, block.w, block.h)))
        names = method_names(block.lines)
        if len(names) > MAX_WORKS_PER_BLOCK:
            raise ValueError(f"{block.period} block has {len(names)} works: {names}")
        banned = sorted(set(names) & BANNED_LABELS)
        if banned:
            raise ValueError(f"{block.period} includes excluded non-WAM labels: {banned}")
        for line in block.lines:
            if text_width(line, block.font_size) > block.w - 26:
                raise ValueError(f"text overflow in {block.period}: {line}")
    for period in PERIODS:
        boxes.append((f"date:{period.label}", date_rect(period)))

    for name, rect in boxes:
        x, y, w, h = padded(rect, 4)
        if x < 0 or y < 0 or x + w > W or y + h > H:
            raise ValueError(f"{name} is out of canvas: {rect}")
        if y + h > RENDER_SAFE_BOTTOM:
            raise ValueError(f"{name} exceeds render-safe bottom {RENDER_SAFE_BOTTOM}: {rect}")

    for i, (name_a, rect_a) in enumerate(boxes):
        for name_b, rect_b in boxes[i + 1 :]:
            if overlaps(padded(rect_a, 4), padded(rect_b, 4)):
                raise ValueError(f"overlap: {name_a} {rect_a} with {name_b} {rect_b}")


def main() -> None:
    blocks = placed_blocks()
    validate_layout(blocks)
    blocks_by_period = {period.label: [block for block in blocks if block.period == period.label] for period in PERIODS}
    block_markup = "\n".join(block_svg(block) for block in blocks)
    stem_markup = "\n".join(stem_svg(period, blocks_by_period[period.label][0]) for period in PERIODS)
    path = stream_path()
    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="style.css">
  <style>
    .timeline-label {{ font-weight: 700; }}
    .date-label {{ font-weight: 700; fill: #26344a; }}
    .legend-title {{ font-size: 22px; font-weight: 700; fill: #1e2738; }}
    .legend-sub {{ font-size: 18px; fill: #48515e; }}
    .time-stem {{ stroke: #9ea9b5; stroke-width: 5; stroke-linecap: round; }}
    .time-ring {{ fill: #ffffff; stroke: #9ca7b5; stroke-width: 5; }}
    .stream-shadow {{ fill: none; stroke: #ffd6df; stroke-width: 26; stroke-linecap: round; stroke-linejoin: round; opacity: 0.88; }}
    .stream-main {{ fill: none; stroke: url(#streamGradient); stroke-width: 18; stroke-linecap: round; stroke-linejoin: round; }}
  </style>
</head>
<body>
<svg viewBox="0 0 1600 900" role="img" aria-label="Timeline of World Action Model design philosophies">
  <defs>
    <linearGradient id="streamGradient" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#f7a8b8"/>
      <stop offset="56%" stop-color="#ef6a41"/>
      <stop offset="100%" stop-color="#bf330f"/>
    </linearGradient>
  </defs>

  {legend_svg()}

  <path class="stream-shadow" d="{path}"/>
  <path class="stream-main" d="{path}"/>

  {stem_markup}
  {block_markup}
</svg>
</body>
</html>
"""
    OUT.write_text(html)
    counts = count_methods()
    print(f"Wrote {OUT}")
    print(
        f"Validated {len(blocks)} method blocks, {len(PERIODS)} date chips, "
        f"and counts {counts} with no overlap."
    )


if __name__ == "__main__":
    main()
