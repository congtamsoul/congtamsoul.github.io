/* =========================================================================
   main.js — theme toggle, mobile nav, post filter, TOC, reading progress
   ========================================================================= */
(function () {
  "use strict";

  /* ------------------------------------------------------- Language */
  var languageToggle = document.getElementById("languageToggle");
  var languageLabel = document.getElementById("languageLabel");

  function readLanguage() {
    var cookie = String(document.cookie || "");
    var match = cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
    if (match && decodeURIComponent(match[1]).toLowerCase().indexOf("/en") !== -1) return "en";
    return localStorage.getItem("language") === "en" ? "en" : "vi";
  }

  function setLanguage(language) {
    var value = language === "en" ? "/vi/en" : "/vi/vi";
    document.cookie = "googtrans=" + value + "; path=/; SameSite=Lax";
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
    if (languageLabel) languageLabel.textContent = language === "en" ? "EN" : "VI";
    if (languageToggle) {
      languageToggle.setAttribute("aria-label", language === "en" ? "Switch to Vietnamese" : "Switch to English");
      languageToggle.title = language === "en" ? "Switch to Vietnamese" : "Switch to English";
    }
  }

  var currentLanguage = readLanguage();
  setLanguage(currentLanguage);
  if (languageToggle) {
    languageToggle.addEventListener("click", function () {
      var nextLanguage = readLanguage() === "en" ? "vi" : "en";
      setLanguage(nextLanguage);
      window.location.reload();
    });
  }

  function hideGoogleTranslateBar() {
    document.documentElement.style.marginTop = "0";
    document.body.style.top = "0";
    document.body.style.marginTop = "0";

    var selectors = ".goog-te-banner-frame, .goog-te-balloon-frame, body > .skiptranslate";
    Array.prototype.forEach.call(document.querySelectorAll(selectors), function (element) {
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("height", "0", "important");
    });
  }

  hideGoogleTranslateBar();
  var translateBarObserver = new MutationObserver(hideGoogleTranslateBar);
  translateBarObserver.observe(document.documentElement, { childList: true, subtree: true });

  /* ---------------------------------------------------------- Theme */
  var root = document.documentElement;
  var saved = localStorage.getItem("theme");
  if (saved) root.setAttribute("data-theme", saved);

  function giscusThemeUrl(theme) {
    return theme === "light"
      ? "https://congtamsoul.github.io/assets/giscus-light.css"
      : "https://congtamsoul.github.io/assets/giscus-dark.css";
  }

  function applyGiscusTheme(theme) {
    var giscusFrame = document.querySelector(".giscus iframe");
    if (giscusFrame) {
      giscusFrame.contentWindow.postMessage({
        giscus: { setConfig: { theme: giscusThemeUrl(theme) } }
      }, "https://giscus.app");
    }
  }

  applyGiscusTheme(root.getAttribute("data-theme") || "dark");
  var giscusObserver = new MutationObserver(function () {
    applyGiscusTheme(root.getAttribute("data-theme") || "dark");
  });
  giscusObserver.observe(document.body, { childList: true, subtree: true });

  var themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      applyGiscusTheme(next);
    });
  }

  /* ----------------------------------------------- View counts */
  var goatCounterScript = document.querySelector("script[data-goatcounter]");
  if (goatCounterScript) {
    var counterBase = goatCounterScript.dataset.goatcounter.replace(/\/count\/?$/, "");
    var viewElements = Array.prototype.slice.call(
      document.querySelectorAll(".post-view-count[data-view-path]")
    );

    function loadViewCount(path) {
      var encodedPath = encodeURIComponent(path);
      return fetch(counterBase + "/counter/" + encodedPath + ".json")
        .then(function (response) {
          if (!response.ok) throw new Error("Không tải được lượt xem cho " + path);
          return response.json();
        })
        .then(function (result) {
          var countText = String(result && result.count != null ? result.count : "")
            .replace(/[^\d]/g, "");
          if (!countText) throw new Error("Dữ liệu lượt xem không hợp lệ cho " + path);
          var count = Number(countText);
          if (!Number.isSafeInteger(count)) throw new Error("Dữ liệu lượt xem không hợp lệ cho " + path);
          return count;
        });
    }

    var countRequests = {};
    viewElements.forEach(function (element) {
      var path = element.dataset.viewPath;
      if (!countRequests[path]) countRequests[path] = loadViewCount(path);
      countRequests[path].then(function (count) {
        element.textContent = "· " + count.toLocaleString("vi-VN") + (document.documentElement.lang === "en" ? " views" : " lượt xem");
        element.hidden = false;
      }).catch(function (error) {
        console.error(error);
      });
    });

    var popularSection = document.getElementById("popularPosts");
    var popularList = document.getElementById("popularList");
    var postGrid = document.getElementById("postGrid");
    if (popularSection && popularList && postGrid) {
      var popularRequests = Array.prototype.map.call(
        postGrid.querySelectorAll(".post-card[data-post-path]"),
        function (card) {
          var path = card.dataset.postPath;
          return countRequests[path].then(function (count) {
            return { card: card, count: count };
          }).catch(function (error) {
            console.error("Không thể lấy lượt xem của bài viết " + path + ".", error);
            return null;
          });
        }
      );

      Promise.all(popularRequests).then(function (posts) {
        posts = posts.filter(Boolean).sort(function (a, b) { return b.count - a.count; });
        posts.slice(0, 3).filter(function (post) { return post.count > 0; })
          .forEach(function (post) {
            var item = document.createElement("li");
            var link = document.createElement("a");
            var title = post.card.querySelector(".post-card h3 a");
            var views = document.createElement("span");
            link.href = title.href;
            link.textContent = title.textContent;
            views.textContent = post.count.toLocaleString("vi-VN") + (document.documentElement.lang === "en" ? " views" : " lượt xem");
            item.appendChild(link);
            item.appendChild(views);
            popularList.appendChild(item);
          });
        if (popularList.children.length) popularSection.hidden = false;
      }).catch(function (error) {
        console.error("Không thể tải danh sách bài đọc nhiều nhất.", error);
      });
    }
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

  /* --------------------------------------------------------- Search */
  var searchToggle = document.getElementById("searchToggle");
  var siteSearch = document.getElementById("siteSearch");
  var siteSearchInput = document.getElementById("siteSearchInput");
  if (searchToggle && siteSearch) {
    if (siteSearchInput) {
      siteSearchInput.value = new URLSearchParams(window.location.search).get("q") || "";
    }

    searchToggle.addEventListener("click", function () {
      var isOpen = !siteSearch.hidden;
      siteSearch.hidden = isOpen;
      searchToggle.setAttribute("aria-expanded", String(!isOpen));
      searchToggle.setAttribute("aria-label", isOpen ? "Mở tìm kiếm" : "Đóng tìm kiếm");
      if (!isOpen && siteSearchInput) siteSearchInput.focus();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !siteSearch.hidden) {
        siteSearch.hidden = true;
        searchToggle.setAttribute("aria-expanded", "false");
        searchToggle.setAttribute("aria-label", "Mở tìm kiếm");
        searchToggle.focus();
      }
    });
  }

  var searchPageForm = document.getElementById("searchPageForm");
  var searchResults = document.getElementById("searchResults");
  var searchStatus = document.getElementById("searchStatus");
  var searchPageInput = document.getElementById("searchPageInput");
  if (searchPageForm && searchResults && searchStatus && searchPageInput) {
    var searchIndexPromise;
    var searchConfig = window.siteSearchConfig || {};

    function normalizeSearchText(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("vi")
        .trim();
    }

    function makeSnippet(item, terms) {
      var source = item.content || item.summary || "";
      var normalized = normalizeSearchText(source);
      var firstMatch = -1;
      terms.some(function (term) {
        var position = normalized.indexOf(term);
        if (position !== -1 && (firstMatch === -1 || position < firstMatch)) {
          firstMatch = position;
        }
        return false;
      });

      if (firstMatch < 0) return (item.summary || source).slice(0, 220);
      var start = Math.max(0, firstMatch - 90);
      var end = Math.min(source.length, firstMatch + 150);
      return (start > 0 ? "…" : "") + source.slice(start, end) + (end < source.length ? "…" : "");
    }

    function makeResult(item, snippet) {
      var link = document.createElement("a");
      link.className = "search-result";
      link.href = item.url;

      var type = document.createElement("span");
      type.className = "search-result-type";
      type.textContent = item.type === "article" ? "Bài viết" : "Trang";

      var title = document.createElement("h2");
      title.textContent = item.title;

      var excerpt = document.createElement("p");
      excerpt.textContent = snippet;

      link.appendChild(type);
      link.appendChild(title);
      link.appendChild(excerpt);
      return link;
    }

    function searchSite(query) {
      var normalizedQuery = normalizeSearchText(query);
      var terms = normalizedQuery.match(/[a-z0-9]+/g) || [];
      searchResults.replaceChildren();

      if (!terms.length) {
        searchStatus.textContent = "Nhập từ khóa để tìm trong bài viết và nội dung trang.";
        return;
      }

      searchStatus.textContent = "Đang tìm kiếm…";
      if (!searchIndexPromise) {
        searchIndexPromise = fetch(searchConfig.indexUrl || "/search.json")
          .then(function (response) {
            if (!response.ok) throw new Error("Không tải được chỉ mục tìm kiếm.");
            return response.json();
          });
      }

      searchIndexPromise.then(function (items) {
        var matches = items.map(function (item) {
          var title = normalizeSearchText(item.title);
          var summary = normalizeSearchText(item.summary);
          var tags = normalizeSearchText(item.tags);
          var content = normalizeSearchText(item.content);
          var searchable = title + " " + summary + " " + tags + " " + content;
          if (!terms.every(function (term) { return searchable.indexOf(term) !== -1; })) {
            return null;
          }

          var score = terms.reduce(function (total, term) {
            return total + (title.indexOf(term) !== -1 ? 10 : 0) +
              (summary.indexOf(term) !== -1 ? 4 : 0) +
              (content.indexOf(term) !== -1 ? 1 : 0);
          }, 0);
          if (title.indexOf(normalizedQuery) !== -1) score += 20;
          return { item: item, score: score };
        }).filter(Boolean).sort(function (a, b) {
          return b.score - a.score || a.item.title.localeCompare(b.item.title, "vi");
        });

        if (!matches.length) {
          searchStatus.textContent = "Không tìm thấy kết quả phù hợp. Thử từ khóa khác nhé.";
          return;
        }

        searchStatus.textContent = "Tìm thấy " + matches.length +
          (matches.length === 1 ? " kết quả." : " kết quả.");
        matches.forEach(function (match) {
          searchResults.appendChild(
            makeResult(match.item, makeSnippet(match.item, terms))
          );
        });
      }).catch(function () {
        searchIndexPromise = null;
        searchStatus.textContent = "Chưa tải được dữ liệu tìm kiếm. Vui lòng thử lại.";
      });
    }

    var queryFromUrl = new URLSearchParams(window.location.search).get("q") || "";
    searchPageInput.value = queryFromUrl;
    if (queryFromUrl) searchSite(queryFromUrl);

    searchPageForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var query = searchPageInput.value.trim();
      var url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
      searchSite(query);
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

  /* -------------------------------------------------- Copy post link */
  var copyLinkBtn = document.getElementById("copyLinkBtn");
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", function (e) {
      e.preventDefault();
      var url = copyLinkBtn.href;
      var done = function () {
        copyLinkBtn.textContent = document.documentElement.lang === "en" ? "Link copied ✓" : "Đã copy link ✓";
        setTimeout(function () {
          copyLinkBtn.textContent = document.documentElement.lang === "en" ? "Copy link" : "Copy link";
        }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      }
    });
  }

  /* -------------------------------------------------- Copy code btn */
  document.querySelectorAll(".prose pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = document.documentElement.lang === "en" ? "Copy" : "Copy";
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
