import { useId } from "react";

type ShoeArtProps = {
  tone?: "orange" | "sage" | "sand";
  className?: string;
  simple?: boolean;
};

/** An original, unbranded illustration. It does not depict a product for sale. */
export default function ShoeArt({
  tone = "orange",
  className = "",
  simple = false,
}: ShoeArtProps) {
  const id = useId().replace(/:/g, "");
  const palette = {
    orange: { main: "#ef6038", dark: "#b33c24", light: "#f4b09b" },
    sage: { main: "#799484", dark: "#486153", light: "#bacabd" },
    sand: { main: "#c6a576", dark: "#886d49", light: "#e3d1b6" },
  }[tone];

  return (
    <svg
      viewBox="0 0 600 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={`${id}-mesh`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-12)"
        >
          <circle cx="2" cy="2" r="0.85" fill="#8e928c" opacity="0.38" />
          <circle cx="6" cy="6" r="0.85" fill="#8e928c" opacity="0.38" />
        </pattern>
        <clipPath id={`${id}-upper`}>
          <path d="M85 216L91 147Q92 129 105 126L128 136C149 155 165 164 190 157L226 115Q236 96 249 103L294 147C327 177 373 177 426 182C469 186 497 197 511 219L517 234C389 255 189 250 85 233Z" />
        </clipPath>
      </defs>

      {!simple && (
        <g stroke={palette.main} strokeLinecap="round" opacity="0.42">
          <path d="M63 156H15" strokeWidth="2" />
          <path d="M67 168H39" strokeWidth="2" />
          <path d="M47 180H11" strokeWidth="2" />
        </g>
      )}

      <ellipse cx="301" cy="278" rx="210" ry="11" fill="#202723" opacity="0.075" />

      <g transform="rotate(-8 300 188)">
        <path d="M98 137L94 107Q93 99 101 98L112 96L120 132" fill="#29312d" />
        <path d="M103 102L109 128" stroke={palette.main} strokeWidth="4" />
        <path d="M107 133Q132 128 160 151L191 157L224 124Q240 116 258 130L266 158L203 185L119 165Z" fill="#29312d" />
        <path d="M116 136Q146 143 162 159L190 166L224 135" stroke="#4c5650" strokeWidth="5" strokeLinecap="round" />

        <path d="M75 218C143 227 180 231 248 230L407 227C453 226 491 223 517 229L526 240Q525 251 500 258C421 277 189 270 98 252Q77 248 73 237Z" fill="#2c342f" />
        <path d="M76 213C140 223 186 227 251 227L408 224C457 221 491 219 514 224L524 236Q519 246 495 250C396 268 177 258 91 241Q76 238 74 229Z" fill="#f6f3e9" stroke="#b5b7ac" strokeWidth="1.6" />
        <path d="M77 228C171 250 383 258 501 240L520 234" stroke="#d4d5c9" strokeWidth="3" />
        <path d="M78 220C145 235 184 239 237 239C267 238 278 232 302 229L413 226" stroke="#c0c5b6" strokeWidth="1.5" />
        <path d="M303 246Q399 252 490 238" stroke={palette.main} strokeWidth="5" strokeLinecap="round" />
        <path d="M88 239L88 248M105 243L105 252M124 246L123 256M145 249L144 259M169 252L168 262M196 254L195 264M224 255L223 266M253 256L252 267M282 256L281 267M312 257L311 268M342 256L341 268M372 256L371 267M403 255L402 265M433 252L432 263M462 249L461 259M489 244L488 254" stroke="#596159" strokeWidth="1.4" />

        <path d="M85 216L91 147Q92 129 105 126L128 136C149 155 165 164 190 157L226 115Q236 96 249 103L294 147C327 177 373 177 426 182C469 186 497 197 511 219L517 234C389 255 189 250 85 233Z" fill="#e6e8de" stroke="#7b877c" strokeWidth="1.6" />
        <path d="M80 100H530V248H80Z" fill={`url(#${id}-mesh)`} clipPath={`url(#${id}-upper)`} />

        <path d="M91 148L110 138L127 150L135 190L166 225L158 240Q115 237 85 230L85 212Z" fill="#d1d7cc" />
        <path d="M93 159L111 153L122 191L151 223L145 232L106 226L90 208Z" fill={palette.main} />
        <path d="M99 167L107 163L117 194L139 220L132 222L108 205Z" fill={palette.light} />
        <path d="M126 155L140 185L169 218" stroke="#8c998b" strokeWidth="1.6" strokeDasharray="3 4" />

        <path d="M150 196L226 159L292 183L315 213L285 233L195 228Z" fill="#faf8ef" stroke="#b2bcac" strokeWidth="1.5" />
        <path d="M169 201L227 174L276 190L294 211L277 219L203 215Z" fill="#27352d" />
        <path d="M186 201L228 183L258 194L268 207L211 205Z" fill={palette.main} />
        <path d="M160 199L226 167L285 187L305 213L281 226L199 222Z" stroke="#9aa594" strokeWidth="1.2" strokeDasharray="2.5 4" />

        <path d="M365 184C433 183 484 194 502 216L510 228L458 233L431 212L357 203Z" fill="#d4dcd0" />
        <path d="M374 192C426 192 467 200 485 215" stroke="#a5b39f" strokeWidth="1.5" strokeDasharray="3 4" />
        <path d="M434 214L458 231L501 226" stroke="#b2beac" strokeWidth="2" />
        <path d="M481 219L487 222M468 216L474 219M454 213L460 216" stroke="#81957e" strokeWidth="1.6" strokeLinecap="round" />

        <path d="M183 160L226 114Q236 102 246 107L289 150L306 169L279 187L246 173L213 174Z" fill="#cbd1c4" stroke="#899a84" strokeWidth="1.4" />
        <path d="M222 126L234 111Q239 108 244 112L261 128L247 143Z" fill={palette.main} />
        <path d="M232 123L241 119L248 126L241 130Z" fill="#f5eee4" />
        <path d="M189 161L223 130L237 140L211 175Z" fill="#f5f4e9" />
        <path d="M247 144L261 136L296 168L280 181Z" fill="#f5f4e9" />
        <g fill="#364b37">
          <circle cx="216" cy="143" r="3" /><circle cx="207" cy="153" r="3" /><circle cx="198" cy="164" r="3" />
          <circle cx="259" cy="147" r="3" /><circle cx="270" cy="157" r="3" /><circle cx="281" cy="168" r="3" />
        </g>
        <g stroke="#faf9f2" strokeWidth="4.5" strokeLinecap="round">
          <path d="M216 143L270 157M207 153L281 168M198 164L271 175M259 147L207 153M270 157L198 164" />
        </g>
        <g stroke="#9ba28d" strokeWidth="0.9" strokeLinecap="round">
          <path d="M217 145L268 158M209 155L278 169M200 166L269 176" />
        </g>
        <path d="M216 141C209 128 206 124 201 129C198 134 205 141 216 141C231 137 235 131 230 128C226 126 219 133 216 141Z" stroke="#f7f5ea" strokeWidth="3.8" />
        <path d="M216 141L211 173M216 141L238 163" stroke="#f7f5ea" strokeWidth="3" strokeLinecap="round" />

        <path d="M317 178L333 215L357 233M320 177C350 187 383 191 413 193" stroke="#a9b4a2" strokeWidth="1.3" />
        <path d="M116 218L136 223" stroke="#323f34" strokeWidth="3" strokeLinecap="round" />
        <path d="M91 229C194 250 384 255 510 233" stroke="#6d7968" strokeWidth="1.5" />
        <path d="M92 232C109 237 121 239 137 241" stroke={palette.dark} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
