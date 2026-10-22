/**
 * openide - JavaScript (Node.js) Sample File
 * Press F5 or click the "Run" button to execute.
 */

// TODO: Add API connector module
// FIXME: Expand error handling middleware

const COLOR_SEEDS = {
  oceanBlue: '#38BDF8',
  royalPurple: '#7C4DFF',
  emeraldGreen: '#10B981',
  sunsetCoral: '#F97316',
  cyberNeon: '#00F5D4'
};

function computeStats(numbers) {
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  const average = sum / numbers.length;
  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  return { sum, average, max, min };
}

console.log('openide - Node.js Runner');
console.log('Node Version:', process.version);
console.log('Platform:', process.platform, process.arch);

const dataset = [14, 28, 42, 56, 70, 84, 98];
console.log('Statistics Result:', computeStats(dataset));
console.log('Material 3 Seed Colors:', COLOR_SEEDS);
