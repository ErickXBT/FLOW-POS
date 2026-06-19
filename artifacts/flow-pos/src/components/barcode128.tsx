import React from "react";

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106
];

interface Barcode128Props {
  value: string;
  width?: number;
  height?: number;
}

export function Barcode128({ value, width = 1.5, height = 50 }: Barcode128Props) {
  if (!value) return null;

  // Let's compute characters for Code 128 Set B
  let sum = 104; // Start B
  const codes: number[] = [104];

  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    let val = charCode - 32; // Set B ASCII starts at 32
    if (val < 0 || val > 95) {
      val = 0; // Default fallback for out-of-range chars
    }
    codes.push(val);
    sum += val * (i + 1);
  }

  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(106); // Stop code

  // Map to pattern string
  let pattern = "";
  for (const code of codes) {
    pattern += CODE128_PATTERNS[code];
  }

  // Calculate total modules
  let totalModules = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalModules += parseInt(pattern[i]);
  }

  const totalWidth = totalModules * width;
  
  // Render bars
  const rects: React.ReactNode[] = [];
  let currentX = 0;
  for (let i = 0; i < pattern.length; i++) {
    const w = parseInt(pattern[i]) * width;
    if (i % 2 === 0) {
      // Bar (black)
      rects.push(
        <rect
          key={i}
          x={currentX}
          y={0}
          width={w}
          height={height}
          fill="black"
        />
      );
    }
    currentX += w;
  }

  return (
    <div className="flex flex-col items-center bg-white p-3.5 rounded-xl border border-border/40 w-fit select-none">
      <svg id={`barcode-svg-${value}`} width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`} className="block">
        {rects}
      </svg>
      <span className="text-[11px] font-bold font-mono text-black mt-2 tracking-widest">{value}</span>
    </div>
  );
}
