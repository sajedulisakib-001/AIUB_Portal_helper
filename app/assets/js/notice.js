async function setupNoticePage() {
  const { data_notice } = await chrome.storage.local.get("data_notice");
  data_notice.new_count = 0;

  chrome.storage.local.set({
    data_notice,
  });

  if (!data_notice || !data_notice.notice) return;

  const container = document.getElementById("notice-container");
  const indicator = document.getElementById("indicator");
  if(indicator)indicator.remove();
  container.innerHTML = "";
  const queue = [];

  data_notice.notice.forEach((notice) => {
      const element = noticeView(notice);

      if (notice.viewed) {
          queue.push(element);
      } else {
          container.appendChild(element);
      }
  });

  queue.forEach(item => {
      container.appendChild(item);
  });

  

  container.addEventListener("click", (e) => {
    const box = e.target.closest(".routine-box");

    if (!box) return;

    const id = Number(box.dataset.id);


    const href = data_notice.notice.find(
        notice => notice.id === id
    )?.url;

    if(!href)return; 

    markNoticeViewed(id,href);
  });
}

function noticeView(n) {
  const dateE = document.createElement("div");
  dateE.classList.add("notice-date");
  dateE.innerText = n.date.formatted;

  const spacer = document.createElement("div");
  spacer.classList.add("notice-seperator");

  const row = document.createElement("div");
  row.classList.add("row-notice");

  const titleE = document.createElement("div");
  titleE.classList.add(
    n.viewed ? "notice-title-viewed" : "notice-title-nonviewed",
  );
  titleE.innerText = n.title;

  const descE = document.createElement("div");
  descE.classList.add("notice-desc");
  descE.innerText = n.description;

  row.appendChild(titleE);
  row.appendChild(descE);

  const mark = document.createElement("div");
  mark.innerText = n.viewed ?"✅" : "⬜" ;

  const col = document.createElement("div");
  col.classList.add("colum-notice");

  col.appendChild(dateE);
  col.appendChild(spacer);
  col.appendChild(row);
  col.appendChild(mark);

  const noticeItem = document.createElement("div");
  noticeItem.classList.add("routine-item");
  if (n.viewed) noticeItem.classList.add("notice-border-viewed");
  noticeItem.appendChild(col);

  const noticeBox = document.createElement("div");
  noticeBox.classList.add("routine-box");
  noticeBox.setAttribute("data-id", n.id);
  noticeBox.appendChild(noticeItem);

  return noticeBox;
}

async function markNoticeViewed(id, href) {
  const { data_notice } = await chrome.storage.local.get("data_notice");

  if (!data_notice || !data_notice.notice) return;

  const notice = data_notice.notice.find((item) => item.id === id);

  if (!notice) return;
  // Already viewed
  if (notice.viewed) return;

  notice.viewed = true;

  chrome.storage.local.set({
    data_notice,
  });

  chrome.tabs.create({
     url: href
  });

  // // Update only clicked item
  // const element = document.querySelector(`.routine-box[data-id="${id}"]`);

  // if (element) {

  //   element.remove();

  //   const container = document.getElementById("notice-container");
  //   const newElement = noticeView(notice);

  //   container.appendChild(newElement);

  //   newElement.addEventListener("click", () => {
  //     markNoticeViewed(id);
  //   });
  // }
}
