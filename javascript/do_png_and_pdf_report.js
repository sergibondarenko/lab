const puppeteer = require('puppeteer');

const delay = function (timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

class Authenticator {
  static async kibana(page, user, pass, appName = 'xpack', loadDelay = 5000) {
    try {
      await page.type('#username', user, {delay: loadDelay / 50});
      await page.type('#password', pass, {delay: loadDelay / 50});

      if (appName === 'xpack') {
        await page.click('.kuiButton');
      } else {
        await page.click('.btn-login');
      }

      await delay(loadDelay);
      await page.click('.global-nav-link--close');
      await delay(loadDelay / 5);
    } catch (err) {
      throw new Error(`fail to authenticate via Search Guard, user: ${user}, ${err}`);
    }
  }

  static async custom(page, user, pass, userSelector, passSelector, loginBtnSelector, loadDelay = 5000) {
    try {
      await page.type(userSelector, user, {delay: loadDelay / 50});
      await page.type(passSelector, pass, {delay: loadDelay / 50});
      await page.click(loginBtnSelector);
      await delay(loadDelay);
    } catch (err) {
      throw new Error(`fail to authenticate via custom auth, user: ${user}, ${err}`);
    }
  }

  static async basic(page, user, pass, encoding = 'base64') {
    try {
      const headers = new Map();
      headers.set('Authorization', `Basic ${new Buffer(`${user}:${pass}`).toString(encoding)}`);
      await page.setExtraHTTPHeaders(headers);
      return page;
    } catch (err) {
      throw new Error(`fail to set basic auth headers, user: ${user}, ${err}`);
    }
  }
}

class Reporter {
  constructor(file) {
    this.file = file;
  }

  async openPage(url, auth = null) {
    this.url = url;
    this.auth = auth;

    try {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
      });

      this.page = await this.browser.newPage();
    } catch (err) {
      throw new Error(`fail to open headless chrome, ${err}`);
    }

    if (this.auth && this.auth.mode.basic) {
      this.page = await Authenticator.basic(this.page, this.auth.user, this.auth.path);
    }

    try {
      await this.page.goto(url, {waitUntil: 'networkidle0'});
    } catch (err) {
      throw new Error(`fail to go to url: ${this.url}`);
    }

    if (this.auth) {
      await this.authenticate(this.auth.mode, this.auth.user, this.auth.pass);
    }
  }

  async authenticate(mode, user, pass) {
    if (mode.searchGuard) {
      await Authenticator.kibana(this.page, user, pass, 'searchguard');
    }

    if (mode.xpack) {
      await Authenticator.kibana(this.page, user, pass, 'xpack');
    }

    if (mode.custom) {
      await Authenticator.custom(this.page, user, pass, '#user', '#pass', '.btn-lg');
    }
  }

  async screenshot() {
    const {path, width, height} = this.file.img.options;
    try {
      await this.page.setViewport({width, height});
      await this.page.screenshot({path});
    } catch (err) {
      throw new Error(`fail to do a screenshot, url: ${this.url}, ${err}`);
    }
  }

  async pdf() {
    try {
      await this.page.pdf(this.file.pdf.options);
    } catch (err) {
      throw new Error(`fail to do a PDF doc, url: ${this.url}, ${err}`);
    }
  }

  async end() {
    try {
      await this.browser.close();
    } catch (err) {
      throw new Error(`fail to close headless chrome, ${err}`);
    }
  }
}

// main
(async () => {
  const url = 'https://repodemo.instacks.com/demo/';
  const auth = {
    user: 'admin',
    pass: 'admin',
    mode: {
      basic: false,
      searchGuard: false,
      xpack: false,
      custom: true,
    },
  };
  const file = {
    pdf: {
      active: true,
      options: {
        path: '/home/trex/Desktop/doc.pdf',
        format: 'A4',
        landscape: true,
      },
    },
    img: {
      active: true,
      options: {
        path: '/home/trex/Desktop/screenshot.png',
        width: 1280,
        height: 900,
      },
    },
  };

  try {
    const report = new Reporter(file);
    await report.openPage(url, auth);
    await report.pdf();
    await report.screenshot();
    await report.end();
  } catch (err) {
    throw err;
  }
})();
