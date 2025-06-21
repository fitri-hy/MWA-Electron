const fs = require('fs');
const path = require('path');
const os = require('os');

const floatingPath = path.join(os.homedir(), '.config', 'M-WA', 'setting', 'floating.json');

function readFloating() {
  try {
    if (fs.existsSync(floatingPath)) {
      const data = fs.readFileSync(floatingPath, 'utf8');
      return JSON.parse(data);
    } else {
      return [
        { floatingItem: true },
        { floatingList: true }
      ];
    }
  } catch (err) {
    console.error('Error reading floating.json:', err);
    return [
      { floatingItem: true },
      { floatingList: true }
    ];
  }
}

function updateFloating(propertyName, value) {
  try {
    const floatingData = readFloating();

    const updated = floatingData.map(obj => {
      if (obj.hasOwnProperty(propertyName)) {
        return { [propertyName]: value };
      }
      return obj;
    });

    fs.writeFileSync(floatingPath, JSON.stringify(updated, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error updating floating.json:', err);
    return false;
  }
}

module.exports = { updateFloating };
