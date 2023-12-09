module.exports = {
  test(value) {
    // Identify the values you want to modify in the snapshot
    return typeof value === 'string' && value.includes('\\');
  },
  print(value) {
    // Modify the value before printing it in the snapshot
    return `"${value.replace(/\\/g, '/')}"`;
  },
};