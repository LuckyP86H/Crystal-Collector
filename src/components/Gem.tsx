import { useId } from "react";

export type Cut = "diamond" | "emerald" | "round" | "hex";

type Point = readonly [number, number];

/** Direction the light comes from, in degrees (0 = right, 90 = down), i.e. the top-left. */
const LIGHT_ANGLE = -135;

function ngon(radius: number, sides: number, startDegrees: number, centre = 50): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = ((startDegrees + (360 / sides) * i) * Math.PI) / 180;
    return [centre + radius * Math.cos(angle), centre + radius * Math.sin(angle)] as const;
  });
}

const toPoints = (points: readonly Point[]) =>
  points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/** Facets facing the light get a white wash, facets facing away get a dark one. */
function toneForAngle(degrees: number): number {
  return Math.cos(((degrees - LIGHT_ANGLE) * Math.PI) / 180);
}

function centroidAngle(points: readonly Point[]): number {
  const x = points.reduce((sum, [px]) => sum + px, 0) / points.length - 50;
  const y = points.reduce((sum, [, py]) => sum + py, 0) / points.length - 50;
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** `tone` runs from -1 (darkest) to 1 (brightest). */
function Facet({ points, tone }: { points: readonly Point[]; tone: number }) {
  return (
    <polygon
      points={toPoints(points)}
      fill={tone >= 0 ? "#fff" : "#000"}
      fillOpacity={Math.abs(tone) * 0.5}
    />
  );
}

function Edges({ lines }: { lines: readonly (readonly [Point, Point])[] }) {
  return (
    <g stroke="#fff" strokeOpacity={0.4} strokeWidth={1.4} strokeLinecap="round">
      {lines.map(([[x1, y1], [x2, y2]]) => (
        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </g>
  );
}

function Outline({ points }: { points: readonly Point[] }) {
  return (
    <polygon
      points={toPoints(points)}
      fill="none"
      stroke="#fff"
      strokeOpacity={0.55}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function Sparkle({ x, y }: { x: number; y: number }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={10}
      ry={4.5}
      transform={`rotate(-35 ${x} ${y})`}
      fill="#fff"
      fillOpacity={0.5}
    />
  );
}

const DIAMOND: readonly Point[] = [
  [50, 92],
  [6, 38],
  [24, 12],
  [76, 12],
  [94, 38],
];

function Diamond({ fill }: { fill: string }) {
  const facets: readonly (readonly [readonly Point[], number])[] = [
    [
      [
        [6, 38],
        [24, 12],
        [36, 38],
      ],
      0.2,
    ],
    [
      [
        [24, 12],
        [50, 12],
        [36, 38],
      ],
      0.75,
    ],
    [
      [
        [50, 12],
        [36, 38],
        [64, 38],
      ],
      0.3,
    ],
    [
      [
        [50, 12],
        [76, 12],
        [64, 38],
      ],
      -0.1,
    ],
    [
      [
        [76, 12],
        [94, 38],
        [64, 38],
      ],
      -0.45,
    ],
    [
      [
        [6, 38],
        [36, 38],
        [50, 92],
      ],
      -0.2,
    ],
    [
      [
        [36, 38],
        [64, 38],
        [50, 92],
      ],
      0.15,
    ],
    [
      [
        [64, 38],
        [94, 38],
        [50, 92],
      ],
      -0.65,
    ],
  ];
  return (
    <>
      <polygon points={toPoints(DIAMOND)} fill={`url(#${fill})`} />
      {facets.map(([points, tone]) => (
        <Facet key={toPoints(points)} points={points} tone={tone} />
      ))}
      <Edges
        lines={[
          [
            [6, 38],
            [94, 38],
          ],
          [
            [24, 12],
            [36, 38],
          ],
          [
            [50, 12],
            [36, 38],
          ],
          [
            [50, 12],
            [64, 38],
          ],
          [
            [76, 12],
            [64, 38],
          ],
          [
            [36, 38],
            [50, 92],
          ],
          [
            [64, 38],
            [50, 92],
          ],
        ]}
      />
      <Outline points={DIAMOND} />
      <Sparkle x={34} y={22} />
    </>
  );
}

/** Step-cut octagon: outer ring, mid ring and a flat table. */
function Emerald({ fill }: { fill: string }) {
  const outer = ngon(52, 8, -112.5);
  const mid = ngon(36, 8, -112.5);
  const table = ngon(22, 8, -112.5);
  return (
    <>
      <polygon points={toPoints(outer)} fill={`url(#${fill})`} />
      {outer.map((a, k) => {
        const b = outer[(k + 1) % 8];
        const c = mid[(k + 1) % 8];
        const d = mid[k];
        if (!b || !c || !d) return null;
        const ring = [a, b, c, d];
        return (
          <Facet key={toPoints(ring)} points={ring} tone={toneForAngle(centroidAngle(ring))} />
        );
      })}
      <Facet points={mid} tone={0.12} />
      <Facet points={table} tone={0.3} />
      <Edges
        lines={outer.flatMap((corner, k) => {
          const m = mid[k];
          const t = table[k];
          return m && t
            ? ([
                [corner, m],
                [m, t],
              ] as const)
            : [];
        })}
      />
      <Outline points={outer} />
      <Sparkle x={32} y={26} />
    </>
  );
}

/** Round brilliant: a circle with an eight-sided table, kite facets and star facets. */
function Round({ fill }: { fill: string }) {
  const table = ngon(22, 8, -67.5);
  const kiteTips = ngon(46, 8, -67.5);
  const starTips = ngon(46, 8, -45);
  return (
    <>
      <circle cx={50} cy={50} r={46} fill={`url(#${fill})`} />
      {table.map((vertex, k) => {
        const next = table[(k + 1) % 8];
        const star = starTips[k];
        const tip = kiteTips[k];
        const previousStar = starTips[(k + 7) % 8];
        if (!next || !star || !tip || !previousStar) return null;
        const kite = [vertex, previousStar, tip, star];
        const triangle = [vertex, next, star];
        return (
          <g key={toPoints(kite)}>
            <Facet points={kite} tone={toneForAngle(centroidAngle(kite)) * 0.8} />
            <Facet points={triangle} tone={toneForAngle(centroidAngle(triangle)) * 0.5} />
          </g>
        );
      })}
      <Facet points={table} tone={0.35} />
      <Edges
        lines={table.flatMap((vertex, k) => {
          const tip = kiteTips[k];
          const star = starTips[k];
          const previousStar = starTips[(k + 7) % 8];
          return tip && star && previousStar
            ? ([
                [vertex, tip],
                [vertex, star],
                [vertex, previousStar],
              ] as const)
            : [];
        })}
      />
      <circle
        cx={50}
        cy={50}
        r={46}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.55}
        strokeWidth={2}
      />
      <Sparkle x={33} y={28} />
    </>
  );
}

function Hex({ fill }: { fill: string }) {
  const outer = ngon(48, 6, -90);
  const inner = ngon(25, 6, -90);
  return (
    <>
      <polygon points={toPoints(outer)} fill={`url(#${fill})`} />
      {outer.map((a, k) => {
        const b = outer[(k + 1) % 6];
        const c = inner[(k + 1) % 6];
        const d = inner[k];
        if (!b || !c || !d) return null;
        const ring = [a, b, c, d];
        return (
          <Facet key={toPoints(ring)} points={ring} tone={toneForAngle(centroidAngle(ring))} />
        );
      })}
      <Facet points={inner} tone={0.3} />
      <Edges
        lines={outer.flatMap((corner, k) => {
          const i = inner[k];
          return i ? ([[corner, i]] as const) : [];
        })}
      />
      <Outline points={outer} />
      <Outline points={inner} />
      <Sparkle x={36} y={30} />
    </>
  );
}

/** Colours come from the surrounding `.crystal[data-gem]` via CSS variables. */
export function Gem({ cut, className }: { cut: Cut; className?: string }) {
  const fill = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--gem-light)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--gem)" }} />
          <stop offset="1" style={{ stopColor: "var(--gem-dark)" }} />
        </linearGradient>
      </defs>
      {cut === "diamond" && <Diamond fill={fill} />}
      {cut === "emerald" && <Emerald fill={fill} />}
      {cut === "round" && <Round fill={fill} />}
      {cut === "hex" && <Hex fill={fill} />}
    </svg>
  );
}
