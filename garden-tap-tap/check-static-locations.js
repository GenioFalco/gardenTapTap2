const fs = require('fs');
const path = require('path');

try {
  // Check static API file
  console.log('Checking static API file:');
  const staticFilePath = path.join(__dirname, 'public/api/locations');
  
  if (fs.existsSync(staticFilePath)) {
    const content = fs.readFileSync(staticFilePath, 'utf8');
    const apiLocations = JSON.parse(content);
    console.log('Locations in static API:');
    console.log(JSON.stringify(apiLocations, null, 2));
  } else {
    console.error(`File not found: ${staticFilePath}`);
  }
} catch (err) {
  console.error('Error reading static API file:', err);
} 