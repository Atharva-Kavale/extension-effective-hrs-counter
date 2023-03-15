document.getElementById("button").onclick = () => {
  chrome.cookies.getAll({ domain: ".keka.com" }, (res) => {
    document.getElementById("text-field").innerText = JSON.stringify(res[1]);
  });
};
