// SVG filters used by FinishedCardImage finish effects; render once per page.
export function FinishFilters() {
  return (
    <svg className="filter-definitions" aria-hidden="true">
      <filter
        id="etched-edges"
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix type="saturate" values="0" result="grey" />
        <feConvolveMatrix
          in="grey"
          order="3"
          kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
          preserveAlpha="true"
          result="edges"
        />
        <feColorMatrix in="edges" values="0 0 0 0 1 0 0 0 0 .88 0 0 0 0 .55 1 1 1 0 -.12" />
      </filter>
    </svg>
  )
}
