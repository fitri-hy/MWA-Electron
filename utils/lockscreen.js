const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
const settingPath = path.join(configDir, 'setting.json');

const defaultSetting = { password: '', enabled: false };
let settingData = defaultSetting;

function loadSetting() {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(settingPath)) {
      fs.writeFileSync(settingPath, JSON.stringify(defaultSetting, null, 2), 'utf-8');
      //console.log('Generated default setting.json.');
    }

    const raw = fs.readFileSync(settingPath, 'utf-8');
    settingData = JSON.parse(raw);
  } catch (err) {
    //console.error('Failed to read or create setting.json:', err);
    settingData = defaultSetting;
  }
}

function lockscreenMiddleware(req, res, next) {
  loadSetting();

  if (!settingData.enabled) {
    return next();
  }
  if (req.session.isUnlocked) {
    return next();
  }
  if (req.path !== '/lockscreen' && req.method === 'GET') {
    return res.redirect('/lockscreen');
  }
  next();
}

function lockscreenGet(req, res) {
  res.render('lockscreen', {
    error: null,
    title: 'Lockscreen',
    darkMode: false
  });
}

function lockscreenPost(req, res) {
  const { password } = req.body;
  if (password === settingData.password) {
    req.session.isUnlocked = true;
    req.flash('success_msg', 'Unlocked successfully');
    return res.redirect('/');
  } else {
    return res.render('lockscreen', {
      error: 'The screen lock password is incorrect!',
      title: 'Lockscreen',
      darkMode: false
    });
  }
}

module.exports = {
  lockscreenMiddleware,
  lockscreenGet,
  lockscreenPost,
  settingData
};
