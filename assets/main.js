/* =========================================================================
   main.js — theme toggle, mobile nav, post filter, TOC, reading progress
   ========================================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------- Theme */
  var root = document.documentElement;
  var saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }

  /* ----------------------------------------------------- Mobile nav */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") navLinks.classList.remove("open");
    });
  }

  /* --------------------------------------------------- Post filter */
  var filterRow = document.getElementById("filterRow");
  var grid = document.getElementById("postGrid");
  if (filterRow && grid) {
    filterRow.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;

      filterRow.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("active");
      });
      btn.classList.add("active");

      var f = btn.dataset.filter;
      grid.querySelectorAll(".post-card").forEach(function (card) {
        var show = f === "all" || card.dataset.cat === f;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* ------------------------------------------------ Subscribe form */
  var form = document.getElementById("subscribeForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      // TODO: đổi thành endpoint thật (Buttondown, Substack, Mailchimp, Formspree...)
      document.getElementById("subscribeMsg").style.display = "block";
      form.reset();
    });
  }

  /* ------------------------------------------- Reading progress bar */
  var bar = document.getElementById("progressBar");
  if (bar) {
    window.addEventListener("scroll", function () {
      var h = document.documentElement;
      var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      bar.style.width = pct + "%";
    }, { passive: true });
  }

  /* --------------------------------- Auto table of contents (posts) */
  var tocList = document.getElementById("tocList");
  var prose = document.querySelector(".prose");
  if (tocList && prose) {
    var heads = prose.querySelectorAll("h2");
    heads.forEach(function (h, i) {
      if (!h.id) h.id = "section-" + (i + 1);
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      tocList.appendChild(li);
    });

    // highlight mục đang đọc
    var links = tocList.querySelectorAll("a");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id);
        });
      });
    }, { rootMargin: "-80px 0px -70% 0px" });
    heads.forEach(function (h) { obs.observe(h); });
  }

  /* -------------------------------------------------- Copy code btn */
  document.querySelectorAll(".prose pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = "Copy";
    btn.style.cssText = "position:absolute;top:10px;right:10px;font-size:12px;padding:4px 10px";
    pre.style.position = "relative";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(pre.innerText.replace(/^Copy\n/, ""));
      btn.textContent = "Đã copy ✓";
      setTimeout(function () { btn.textContent = "Copy"; }, 1800);
    });
    pre.appendChild(btn);
  });
})();
