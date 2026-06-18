(() => {
  // ── State ─────────────────────────────────────────────────────────────────
  let count = 0;

  // ── Logger ────────────────────────────────────────────────────────────────
  // Uses %c CSS styling so extension logs stand out from the site's own output.
  const BADGE =
    "background:#6366f1;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;";
  const TEXT = "color:#a5b4fc;font-weight:500;";
  const WARN =
    "background:#f59e0b;color:#000;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;";
  const ERROR =
    "background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;";

  const logger = {
    info: (...args) =>
      console.log(`%c Keka Ext %c ${args[0]}`, BADGE, TEXT, ...args.slice(1)),
    warn: (...args) =>
      console.warn(`%c Keka Ext %c ${args[0]}`, WARN, TEXT, ...args.slice(1)),
    error: (...args) =>
      console.error(`%c Keka Ext %c ${args[0]}`, ERROR, TEXT, ...args.slice(1)),
  };

  // ── XPath constants ───────────────────────────────────────────────────────
  const CARD_BODY_XPATH =
    '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/employee-attendance-stats/div/div[3]/employee-attendance-request-actions/div/div/div';
  const LAST_LOG_BODY_XPATH =
    '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/div/employee-attendance-logs/div/employee-attendance-list-view/div/div[2]/div[1]/div/div[1]';
  const LAST_LOG_XPATH =
    '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/div/employee-attendance-logs/div/employee-attendance-list-view/div/div[2]/div[1]/div/div[1]/div/div[2]/div/div[6]/div/span';
  const LOG_DATA_XPATH =
    '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/div/employee-attendance-logs/div/employee-attendance-list-view/div/div[2]/div[1]/div/div[2]/div/div[2]/div[2]/div/div[2]/div';

  // ── DOM utility helpers ───────────────────────────────────────────────────

  /**
   * Creates and returns a new DOM element of the given tag name.
   * @param {string} tag - A valid HTML tag name (e.g. "div", "span", "img")
   * @returns {HTMLElement}
   */
  function createElement(tag) {
    return document.createElement(tag);
  }

  /**
   * Queries the document for a single node using an XPath expression.
   * @param {string} path - A valid XPath expression
   * @returns {Node|null} The first matching node, or null if not found
   */
  function getByXpath(path, parentEle = document) {
    return document.evaluate(
      path,
      parentEle,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue;
  }

  // ── Pure time helpers ─────────────────────────────────────────────────────

  /**
   * Converts a time array into total seconds.
   * @param {number[]} a1 - Time in [hh, mm, ss] format as per 24hr clock
   * @returns {number} Total seconds
   */
  function dateArrToSec(a1) {
    return a1[0] * 60 * 60 + a1[1] * 60 + a1[2];
  }

  /**
   * Converts total seconds into a [hours, minutes] array.
   * @param {number} totalSec - Seconds to convert
   * @returns {[number, number]} Time as [hh, mm]
   */
  function secToDateArr(totalSec) {
    const hh = Math.floor(totalSec / 60 / 60);
    const mm = Math.floor(totalSec / 60 - hh * 60);
    return [hh, mm];
  }

  /**
   * Returns the elapsed time between a given clock-in time and now.
   * @param {string[]} lDate - Clock-in parts in ["HH", "MM", "SS", "AM|PM"] format
   * @returns {[number, number]} Elapsed time as [hours, minutes]
   */
  function getDiff(lDate) {
    // Snapshot current time once to avoid inconsistency across calls
    const now = new Date();
    const cDate = [now.getHours(), now.getMinutes(), now.getSeconds()];

    // Parse the clock-in parts without mutating the original array
    const parts = [...lDate];
    const period = parts.pop(); // "AM" or "PM"
    const normalizedDate = parts.map((r, i) =>
      i === 0 && period === "PM" ? parseInt(r) + 12 : parseInt(r),
    );

    const previousSeconds = dateArrToSec(normalizedDate);
    const currentSeconds = dateArrToSec(cDate);
    return secToDateArr(currentSeconds - previousSeconds);
  }

  /**
   * Adds two [hours, minutes] tuples and returns a formatted time string.
   * @param {[number, number]} diffArr - Elapsed time as [hours, minutes]
   * @param {[number, number]} eArr    - Effective hours as [hours, minutes]
   * @returns {string} Formatted result, e.g. "9h : 30m"
   */
  function sumHoursMinutes(diffArr, eArr) {
    let mm = diffArr[1] + eArr[1];
    let hh = diffArr[0] + eArr[0];

    while (mm >= 60) {
      mm -= 60;
      hh++;
    }
    return `${hh}h : ${mm}m`;
  }

  /**
   * Returns the suggested logout time so the total effective hours reach the target.
   * Formula: now + (target − fTime). Returns null if target already met.
   * @param {string}  fTime     - e.g. "7h : 45m"
   * @param {boolean} isHalfDay - true if a half-day badge is present (target = 5h, else 9h)
   * @returns {string|null} e.g. "6:30 PM", or null if target already met
   */
  function computeLogoutTime(fTime, isHalfDay) {
    const totalHours = isHalfDay ? 5 : 9;
    const effectiveMins = parseInt(fTime) * 60 + parseInt(fTime.split(": ")[1]);
    const remainingMins = totalHours * 60 - effectiveMins;
    if (remainingMins <= 0) return null;
    const logout = new Date(Date.now() + (remainingMins + 1) * 60_000);
    return logout.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // ── DOM queries ───────────────────────────────────────────────────────────

  /** @returns {Element|null} The stats card body container */
  function getCardBody() {
    return getByXpath(CARD_BODY_XPATH);
  }

  /** @returns {Element|null} The latest attendance log row element */
  function getLastLogBody() {
    return getByXpath(LAST_LOG_BODY_XPATH);
  }

  /** @returns {Element|null} The latest attendance log row menu */
  function getLatestLog(parentEle) {
    return getByXpath(LAST_LOG_XPATH, parentEle);
  }

  /**
   * Returns the span elements from the expanded log data container.
   * @returns {NodeList} Span elements inside the log data container
   */
  function getLogData() {
    return getByXpath(LOG_DATA_XPATH).querySelectorAll("span.ng-star-inserted");
  }

  // ── Parsing ───────────────────────────────────────────────────────────────

  /**
   * Extracts the last clock-in time from log data as a parseable string array.
   * @param {NodeList} logData - Span elements from the log data container
   * @returns {string[]} Parts in ["HH", "MM", "SS", "AM|PM"] format
   */
  function parseClockIn(logData) {
    const clockInString = logData[logData.length - 2].innerText;
    const [timePart, period] = clockInString.split(" ");
    const parts = timePart.split(":");
    parts.push(period);
    return parts;
  }

  /**
   * Computes the final effective hours to display and the suggested logout time.
   * If the last log entry is "MISSING" (user is still clocked in), adds the
   * elapsed time since clock-in to the existing effective hours.
   * Otherwise returns the completed effective hours string as-is.
   * @param {NodeList} logData - Span elements from the log data container
   * @returns {{ fTime: string, logoutTime: string|null }}
   */
  function computeFinalTime(logData) {
    const effectiveHourString = document
      .getElementsByClassName("open")[0]
      .querySelectorAll("span:not([class])")[0].innerText;

    // Resolve half-day status here (DOM concern) before passing to pure computation
    const isHalfDay = !!getLastLogBody()?.getElementsByClassName("badge").length;

    if (logData[logData.length - 1].innerText === "MISSING") {
      const clockInArr = parseClockIn(logData);
      const effectiveHours = [
        parseInt(effectiveHourString.split("h")[0]),
        parseInt(effectiveHourString.split("m +")[0].split(" ").pop()),
      ];
      const fTime = sumHoursMinutes(getDiff(clockInArr), effectiveHours);
      return {
        fTime,
        logoutTime: computeLogoutTime(fTime, isHalfDay),
      };
    }

    return { fTime: effectiveHourString, logoutTime: null };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Builds and injects the effective-hours display widget into the card body.
   * Removes any previously injected widget before re-rendering.
   * @param {boolean}     flagLog    - Whether the user has a clock-in log today
   * @param {string}      fTime      - Formatted time string to display (e.g. "8h : 30m")
   * @param {string|null} logoutTime - Suggested logout time in AM/PM (e.g. "6:30 PM"), or null
   * @param {Element}     cBody      - The card-body DOM element to render into
   */
  function paintToDOM(flagLog, fTime, logoutTime, cBody) {
    if (!cBody) {
      logger.warn(
        "Card body not found in DOM — is the attendance page fully loaded?",
      );
      return;
    }

    if (cBody.children.length > 1) {
      cBody.removeChild(cBody.lastChild);
    }

    const wrapper = createElement("div");
    wrapper.className = "keka-ext-wrapper";

    const finalTimerDisplayEl = createElement("div");
    const div1 = createElement("div");
    const div2 = createElement("div");
    const div3 = createElement("div");

    const logoutTimeEl = createElement("div");

    // Div1: clock icon
    const timerImg = createElement("img");
    timerImg.src = chrome.runtime.getURL("assets/clock.svg");
    timerImg.width = "30";
    div1.appendChild(timerImg);

    // Div2: time label
    const timerSpan = createElement("span");
    timerSpan.innerText = flagLog ? fTime : "User not logged yet";
    timerSpan.className = "keka-ext-label";
    div2.appendChild(timerSpan);

    // Div3: refresh button
    const refreshImg = createElement("img");
    refreshImg.src = chrome.runtime.getURL("assets/refresh.png");
    refreshImg.className = "keka-ext-btn";

    // Double requestAnimationFrame ensures the browser has painted the
    // initial state (opacity:0, rotate:0) before the transition fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => refreshImg.classList.add("spin"));
    });

    refreshImg.addEventListener("click", () => {
      cBody.removeChild(cBody.lastChild);
      scriptRunner();
    });
    div3.appendChild(refreshImg);

    finalTimerDisplayEl.appendChild(div1);
    finalTimerDisplayEl.appendChild(div2);
    finalTimerDisplayEl.appendChild(div3);
    finalTimerDisplayEl.className = "keka-ext-row";

    logoutTimeEl.className = "keka-ext-logout-time";
    if (logoutTime) {
      logoutTimeEl.innerText = `Logout time : ${logoutTime}`;
    } else {
      logoutTimeEl.innerText = "";
      logoutTimeEl.classList.add("hidden");
    }

    wrapper.appendChild(finalTimerDisplayEl);
    wrapper.appendChild(logoutTimeEl);

    cBody.appendChild(wrapper);
  }

  // ── Orchestrator ──────────────────────────────────────────────────────────

  /**
   * Queries the DOM for attendance data and renders the effective-hours widget.
   * Handles both the "still clocked in" (MISSING) and "clocked out" states.
   */
  function scriptRunner() {
    const cardBody = getCardBody();

    const lastLogBody = getLastLogBody();
    if (!lastLogBody) {
      throw new Error(
        "Last log not found in DOM — is the attendance page fully loaded?",
      );
    }

    const latestLog = getLatestLog(lastLogBody);
    const isUserLogged = !!latestLog;

    if (!isUserLogged) {
      paintToDOM(false, "", null, cardBody);
      return;
    }

    if (!document.getElementsByClassName("open")[1]) {
      latestLog.click();
    }

    const logData = getLogData();
    const { fTime, logoutTime } = computeFinalTime(logData);
    paintToDOM(isUserLogged, fTime, logoutTime, cardBody);
    latestLog.click();
  }

  // ── Retry logic ───────────────────────────────────────────────────────────

  function runWithRetry() {
    try {
      scriptRunner();
    } catch (error) {
      logger.error(`Unknown error (attempt ${count + 1}/10)`, error);
      logger.info("Retrying...");
      count++;
      if (count < 10) setTimeout(runWithRetry, 1000);
    }
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  function handleUrlChange(currentUrl) {
    if (currentUrl.endsWith("#/me/attendance/logs")) {
      count = 0; // reset retry counter on every fresh navigation
      logger.info("URL matched — starting script...");
      setTimeout(runWithRetry, 1000);
    }
  }

  // Listen for dynamic URL changes
  navigation.addEventListener("navigatesuccess", () => {
    handleUrlChange(window.location.href);
  });
})();
