function checkNodeVersion(minMajorVersion) {
  const match = process.version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    console.error('Unknown Node.JS version: ' + process.version);
    process.exit(0);
  }
  const major = parseInt(match[1]);
  if (Number.isFinite && major < minMajorVersion) {
    console.error(
      `Node.JS version must greater than ${minMajorVersion}.x, current version is "${process.version}"`
    );
    process.exit(-1);
  }
}

// Check Node.JS version must greater than 14.x
checkNodeVersion(14);
process.exit(0);
