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
      // let finalRemain = expectedLeaveTime(hh, mm);
      // console.log(finalRemain);
      return `${hh}h : ${mm}m`;
    }

    // function expectedLeaveTime(hh, mm) {
    //   let finalhh = 8 - hh;
    //   let finalmm = 15 - mm;

    //   if (finalmm < 0) {
    //     finalmm += 60;
    //     finalhh--;
    //   }

    //   return `${finalhh}h : ${finalmm}m`;
    // }

    const cardBody = document.getElementsByClassName("card-body");

    const latestLog = cardBody[cardBody.length - 1]
      .getElementsByClassName("dropdown attendance-logs-row")[0]
      .getElementsByClassName(
        "d-flex align-items-center px-16 py-12 on-hover border-bottom"
      )[0];

    latestLog.click();
    const logData = document
      .getElementsByClassName("open")[1]
      .querySelectorAll("span:not(.icon)");
    const lastClockInString = logData[logData.length - 2].innerText;
    const temp = lastClockInString.split(" ");
    const lastClockInArr = temp[0].split(":");
    lastClockInArr.push(temp[1]);
    const lastEffectiveHourString =
      latestLog.getElementsByTagName("span")[1].innerText;

    const lastEffectiveHourArr = [];

    let finalTime;

    if (logData[logData.length - 1].innerText == "MISSING") {
      lastEffectiveHourArr.push(lastEffectiveHourString.split("h")[0]);
      lastEffectiveHourArr.push(
        lastEffectiveHourString.split("m +")[0].split(" ").pop()
      );
      const a1 = [...lastClockInArr];
      let effectiveHours = [...lastEffectiveHourArr];
      const diff = getDiff(a1);
      effectiveHours = effectiveHours.map((m) => parseInt(m));
      finalTime = add(diff, effectiveHours);
    } else {
      finalTime = lastEffectiveHourString;
    }

    console.log(finalTime);

    function getElement(eleName) {
      return document.createElement(eleName);
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
    timerSpan.innerText = finalTime;
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

    setTimeout(() => {
      refreshImg.style.transform = "rotate(720deg)";
      refreshImg.style.opacity = "1";
    }, 10);

    refreshImg.addEventListener("click", () => {
      cardBody[2].removeChild(cardBody[2].lastChild);
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

    cardBody[2].appendChild(finalTimerDisplayEl);

    latestLog.click();
  }

  setTimeout(scriptRunner, 5000);
})();
