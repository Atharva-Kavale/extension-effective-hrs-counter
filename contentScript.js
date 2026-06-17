(() => {
  function scriptRunner() {
    /**
     * Converts Date array into seconds
     * @param a1 pass data in [hh:mm:ss] format as per 24hr clock
     * @returns converted seconds from given date array in number format
     */
    function dateArrToSec(a1) {
      let totalSec = 0;

      totalSec += a1[0] * 60 * 60;
      totalSec += a1[1] * 60;
      totalSec += a1[2];

      return totalSec;
    }

    /**
     * Converts seconds into date array
     * @param totalSec pass seconds in number format
     * @returns converted data array in [hh:mm] format as per 24hr clock
     */
    function secToDateArr(totalSec) {
      let hh = Math.floor(totalSec / 60 / 60);
      let mm = Math.floor(totalSec / 60 - hh * 60);

      return [hh, mm];
    }

    function getDiff(lDate) {
      //Getting Current Time Starts
      const cDate = [];

      cDate.push(new Date().getHours());
      cDate.push(new Date().getMinutes());
      cDate.push(new Date().getSeconds());
      //Getting Current Time Ends

      //Parsing given date String starts
      const time = lDate.pop();
      lDate = lDate.map((r, i) => {
        return i == 0 && time == "PM" ? parseInt(r) + 12 : parseInt(r);
      });
      //Parsing given date String ends

      const previousSeconds = dateArrToSec(lDate);
      const currentSeconds = dateArrToSec(cDate);
      return secToDateArr(currentSeconds - previousSeconds);
    }

    function add(diffArr, eArr) {
      let mm = diffArr[1] + eArr[1];
      let hh = diffArr[0] + eArr[0];

      while (mm >= 60) {
        mm -= 60;
        hh++;
      }
      return `${hh}h : ${mm}m`;
    }

    function getByXpath(path) {
      return document.evaluate(
        path,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue;
    }

    function paintToDOM(flagLog, fTime, cBody) {
      if (!cBody) {
        console.log("cardbody is not present");
        return;
      }

      if (cBody.children.length > 1) {
        cBody.removeChild(cBody.lastChild);
      }

      const finalTimerDisplayEl = getElement("div");

      const div1 = getElement("div");
      const div2 = getElement("div");
      const div3 = getElement("div");

      //Div1 container starts
      const timerImg = getElement("img");
      timerImg.src = chrome.runtime.getURL("assets/clock.svg");
      timerImg.width = "30";

      div1.appendChild(timerImg);
      //Div1 container ends

      //Div2 container starts
      const timerSpan = getElement("span");
      timerSpan.innerText = flagLog ? fTime : "User not logged yet";
      timerSpan.style.fontWeight = "500";
      timerSpan.style.fontSize = "18px";

      div2.appendChild(timerSpan);
      //Div2 container ends

      //Div3 container starts
      const refreshImg = getElement("img");
      refreshImg.src = chrome.runtime.getURL("assets/refresh.png");
      refreshImg.style.padding = "15px";
      refreshImg.style.borderRadius = "50%";
      refreshImg.style.transitionDuration = "2000ms";
      refreshImg.style.transform = "rotate(0deg)";
      refreshImg.style.opacity = "0";
      refreshImg.style.cursor = "pointer";

      setTimeout(() => {
        refreshImg.style.transform = "rotate(720deg)";
        refreshImg.style.opacity = "1";
      }, 10);

      refreshImg.addEventListener("click", () => {
        cBody.removeChild(cBody.lastChild);
        scriptRunner();
      });

      div3.appendChild(refreshImg);
      //Div3 container ends

      finalTimerDisplayEl.appendChild(div1);
      finalTimerDisplayEl.appendChild(div2);
      finalTimerDisplayEl.appendChild(div3);

      finalTimerDisplayEl.style.flexGrow = 1;
      finalTimerDisplayEl.style.display = "flex";
      finalTimerDisplayEl.style.alignItems = "center";
      finalTimerDisplayEl.style.gap = "5px";

      cBody.appendChild(finalTimerDisplayEl);
    }

    const cardBodyXpath =
      '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/employee-attendance-stats/div/div[3]/employee-attendance-request-actions/div/div/div';
    const cardBody = getByXpath(cardBodyXpath);

    const lastLogXpath =
      '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/div/employee-attendance-logs/div/employee-attendance-list-view/div/div[2]/div[1]/div/div[1]/div/div[2]/div/div[6]/div/span';
    const latestLog = getByXpath(lastLogXpath);

    let isUserLogged = !!latestLog;

    if (!isUserLogged) {
      paintToDOM(isUserLogged, "", cardBody);
      return;
    }

    if (!document.getElementsByClassName("open")[1] && isUserLogged) {
      latestLog.click();
    }

    const logDataXpath =
      '//*[@id="preload"]/xhr-app-root/div/employee-me/div/employee-attendance/div/div/div/div/div/employee-attendance-logs/div/employee-attendance-list-view/div/div[2]/div[1]/div/div[2]/div/div[2]/div[2]/div/div[2]/div';

    const logData = getByXpath(logDataXpath).querySelectorAll(
      "span.ng-star-inserted",
    );

    const lastClockInString = logData[logData.length - 2].innerText;
    const temp = lastClockInString.split(" ");
    const lastClockInArr = temp[0].split(":");
    lastClockInArr.push(temp[1]);

    const lastEffectiveHourString = document
      .getElementsByClassName("open")[0]
      .querySelectorAll("span:not([class])")[0].innerText;
    const lastEffectiveHourArr = [];

    let finalTime = 0;

    if (logData[logData.length - 1].innerText == "MISSING") {
      lastEffectiveHourArr.push(lastEffectiveHourString.split("h")[0]);
      lastEffectiveHourArr.push(
        lastEffectiveHourString.split("m +")[0].split(" ").pop(),
      );
      const a1 = [...lastClockInArr];
      let effectiveHours = [...lastEffectiveHourArr];
      const diff = getDiff(a1);
      effectiveHours = effectiveHours.map((m) => parseInt(m));
      finalTime = add(diff, effectiveHours);
    } else {
      finalTime = lastEffectiveHourString;
    }

    function getElement(eleName) {
      return document.createElement(eleName);
    }

    paintToDOM(isUserLogged, finalTime, cardBody);

    latestLog.click();
  }

  function Executer() {
    try {
      scriptRunner();
    } catch (error) {
      console.warn("Unkown error to DOM", count);
      console.log("Retrying...");
      count++;
      if (count < 10) setTimeout(Executer, 1000);
    }
  }

  let count = 0,
    flag = -1;

  // Listen for dynamic URL changes
  navigation.addEventListener("navigatesuccess", () => {
    handleUrlChange(window.location.href);
  });

  function handleUrlChange(currentUrl) {
    if (currentUrl.slice(-20) == "#/me/attendance/logs") {
      console.log("URL matched, starting script...");
      setTimeout(Executer, 1000);
    }
  }
})();
