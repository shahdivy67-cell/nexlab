// NexLab — Linear algebra utilities for the circuit solver.
// Dense Gaussian elimination with partial pivoting.

export function solveLinearSystem(A, b) {
  // A: array of arrays (n x n), b: array (n). Returns x or null if singular.
  const n = b.length;
  if (n === 0) return [];
  // Deep copy to avoid mutating caller data
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) { maxVal = v; maxRow = r; }
    }
    if (maxVal < 1e-15) return null; // singular
    if (maxRow !== col) {
      const tmp = M[maxRow]; M[maxRow] = M[col]; M[col] = tmp;
    }
    // Eliminate below
    const pivot = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      M[r][col] = 0;
      for (let c = col + 1; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    x[r] = sum / M[r][r];
  }
  return x;
}

// Solve A x = b where A may be symmetric — kept simple, same routine.
export function solve(A, b) {
  return solveLinearSystem(A, b);
}

// Equivalent resistance between two nodes of a resistive network.
// `stampResistor`-style callbacks are provided by the caller so this
// function stays independent of circuit details.
export function equivalentResistance(buildNetwork, nodeA, nodeB) {
  // buildNetwork(A, z, size) stamps conductances and returns {size, nodeCount}
  // with sources already zeroed by the caller. We inject 1A at A, extract at B.
  const probe = { size: 0 };
  const size = buildNetwork(null, null, probe);
  if (size === 0 || nodeA === nodeB) return 0;
  const A = Array.from({ length: size }, () => new Array(size).fill(0));
  const z = new Array(size).fill(0);
  buildNetwork(A, z, { size: 0 });
  // 1A current source from B to A (entering A)
  z[nodeA] += 1;
  z[nodeB] -= 1;
  const x = solveLinearSystem(A, z);
  if (!x) return Infinity;
  return Math.abs(x[nodeA] - x[nodeB]);
}
