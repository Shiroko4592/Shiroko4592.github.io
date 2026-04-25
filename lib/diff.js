function diffLines(a, b) {
  const aL = a.split('\n');
  const bL = b.split('\n');
  const m = aL.length, n = bL.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aL[i] === bL[j]) dp[i][j] = 1 + dp[i + 1][j + 1];
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (aL[i] === bL[j]) { ops.push({ op: '=', line: aL[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: '-', line: aL[i], a: i + 1 }); i++; }
    else { ops.push({ op: '+', line: bL[j], b: j + 1 }); j++; }
  }
  while (i < m) ops.push({ op: '-', line: aL[i], a: ++i });
  while (j < n) ops.push({ op: '+', line: bL[j], b: ++j });
  return ops;
}

module.exports = { diffLines };
