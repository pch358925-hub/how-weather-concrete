const DEFAULT_PROJECT_NAME = "세종천안 2공구 (주)한화";
const DAY_COUNT = 5;
const PHOTO_TYPES = {
  CURING: "curing",
  TEMPERATURE: "temperature",
};
const PHOTO_MISSING_TEXT = "사진 미등록";
const RAIN_HOLD_TEXT = "우천으로 인한 양생 대기";
const DEFAULT_PHOTO_TYPE = PHOTO_TYPES.CURING;
const TEMPERATURE_VISIBILITY_STORAGE_KEY = "concrete-photo-board-ui:temperature-visible";
const TEMPERATURE_SHOW_CODE = "표시";
const TEMPERATURE_HIDE_CODE = "숨김";
const PHOTO_TYPE_CONFIG = {
  [PHOTO_TYPES.CURING]: {
    label: "습윤양생",
    sectionTitle: "습윤양생 사진",
    contentText: "습윤양생",
    shortLabel: "양생",
    missingText: PHOTO_MISSING_TEXT,
    slotLabel: (slot) => `${slot}일차`,
    slotDateLabel: (slot) => formatDayDate(slot),
    slotCompactLabel: (slot) => formatCompactDayDate(slot),
  },
  [PHOTO_TYPES.TEMPERATURE]: {
    label: "온도측정",
    sectionTitle: "온도측정 사진",
    contentText: "온도측정",
    shortLabel: "측정",
    missingText: PHOTO_MISSING_TEXT,
    slotLabel: (slot) => `측정 ${slot}`,
    slotDateLabel: () => "필요 시",
    slotCompactLabel: () => "순번",
  },
};
const LOCAL_PREFIX = "curing-photo-board:";
const META_DRAFT_PREFIX = `${LOCAL_PREFIX}meta-draft:`;
const STORAGE_DISPLAY_LIMIT_BYTES = 1024 * 1024 * 1024;
const ESTIMATED_PHOTO_BYTES = 450 * 1024;
const IMAGE_MAX_WIDTH = 1280;
const IMAGE_MAX_HEIGHT = 853;
const IMAGE_QUALITY = 0.7;
const PRINT_PAGE_GROUPS = [[1, 2], [3, 4], [5, null]];
const PRINT_MM_SCALE = 6;
const PRINT_PAGE_WIDTH_MM = 210;
const PRINT_PAGE_HEIGHT_MM = 297;
const PRINT_TABLE_WIDTH_MM = 152.02;
const PRINT_TABLE_HEIGHT_MM = 210.1;
const PRINT_LABEL_WIDTH_MM = 22.03;
const PRINT_MAIN_WIDTH_MM = 113.91;
const PRINT_DAY_WIDTH_MM = 16.08;
const PRINT_PHOTO_ROW_HEIGHT_MM = 84;
const PRINT_INFO_ROW_HEIGHT_MM = 10.525;
const PRINT_PHOTO_WIDTH_MM = 120;
const PRINT_PHOTO_HEIGHT_MM = 80;
const STANDARD_DOCUMENT_MIN_ZOOM = 0.75;
const STANDARD_DOCUMENT_MAX_ZOOM = 3;
const STANDARD_DOCUMENT_ZOOM_STEP = 0.25;
const STANDARD_DOCUMENT_PAGE_WIDTH = 1488;
const STANDARD_DOCUMENT_PAGE_HEIGHT = 2103;
const STANDARD_DOCUMENTS = {
  kcs: {
    title: "KCS 14 20 41 : 2025 서중 콘크리트",
    pages: buildStandardDocumentPages("standards/kcs-14-20-41-2025/pages", 11),
  },
  excs: {
    title: "EXCS 14 20 41 : 2021 서중 콘크리트",
    pages: buildStandardDocumentPages("standards/excs-14-20-41-2021/pages", 8),
  },
};
const STANDARD_DOCUMENT_SEARCH_INDEX = window.STANDARD_DOCUMENT_SEARCH_INDEX || {};

function buildStandardDocumentPages(folder, pageCount) {
  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return {
      pageNumber,
      src: `${folder}/page-${String(pageNumber).padStart(2, "0")}.webp`,
      width: STANDARD_DOCUMENT_PAGE_WIDTH,
      height: STANDARD_DOCUMENT_PAGE_HEIGHT,
    };
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const elements = {
  standardButton: document.getElementById("standardButton"),
  standardPanel: document.getElementById("standardPanel"),
  standardDocViewer: document.getElementById("standardDocViewer"),
  standardDocTitle: document.getElementById("standardDocTitle"),
  standardDocPageLabel: document.getElementById("standardDocPageLabel"),
  standardDocZoomOut: document.getElementById("standardDocZoomOut"),
  standardDocZoomIn: document.getElementById("standardDocZoomIn"),
  standardDocZoomLabel: document.getElementById("standardDocZoomLabel"),
  standardDocClose: document.getElementById("standardDocClose"),
  standardDocStage: document.getElementById("standardDocStage"),
  standardDocPages: document.getElementById("standardDocPages"),
  standardDocSearchInput: document.getElementById("standardDocSearchInput"),
  standardDocSearchCount: document.getElementById("standardDocSearchCount"),
  searchButton: document.getElementById("searchButton"),
  printButton: document.getElementById("printButton"),
  newBoardButton: document.getElementById("newBoardButton"),
  boardSearchBar: document.getElementById("boardSearchBar"),
  boardSearchInput: document.getElementById("boardSearchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  storageMeterText: document.getElementById("storageMeterText"),
  storageMeterBar: document.getElementById("storageMeterBar"),
  boardList: document.getElementById("boardList"),
  projectNameInput: document.getElementById("projectNameInput"),
  pourPartInput: document.getElementById("pourPartInput"),
  pourDateInput: document.getElementById("pourDateInput"),
  prevPourDateButton: document.getElementById("prevPourDateButton"),
  nextPourDateButton: document.getElementById("nextPourDateButton"),
  photoSectionTitle: document.getElementById("photoSectionTitle"),
  photoTypeTabs: document.getElementById("photoTypeTabs"),
  summaryList: document.getElementById("summaryList"),
  dayGrid: document.getElementById("dayGrid"),
  printArea: document.getElementById("printArea"),
  photoViewer: document.getElementById("photoViewer"),
  photoViewerImage: document.getElementById("photoViewerImage"),
  photoViewerClose: document.getElementById("photoViewerClose"),
  syncStatus: document.getElementById("syncStatus"),
  toast: document.getElementById("toast"),
};

const config = window.CONCRETE_PHOTO_CONFIG || {};
let dbClient = null;
let realtimeChannel = null;
let metaSaveTimer = null;
let boardList = [];
let boardSearchQuery = "";
let boardListRenderFrame = 0;
let isBoardSearchComposing = false;
let isFilePickerOpen = false;
let filePickerClearTimer = null;
let pendingRealtimeRefresh = false;
let activePhotoMutationCount = 0;
let boardLoadToken = 0;
let printPreviewRenderToken = 0;
let printPreviewTimer = null;
let activePhotoType = DEFAULT_PHOTO_TYPE;
let printImageCache = {
  signature: "",
  images: [],
};
let isTemperatureAccessVisible = loadTemperatureAccessVisible();
let activeStandardDocumentKey = "";
let activeStandardDocumentPage = 1;
let standardDocumentZoom = 1;
let standardDocumentSearchMatches = [];
let standardDocumentScrollFrame = 0;

let state = {
  shareCode: "",
  boardId: null,
  projectName: DEFAULT_PROJECT_NAME,
  pourPart: "",
  pourDate: "",
  createdAt: "",
  entries: {},
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.shareCode = ensureShareCode();
  bindEvents();
  setSyncStatus("저장소를 확인하는 중입니다.");

  if (canUseCloud()) {
    await setupCloudMode();
  } else {
    if (state.shareCode) {
      loadLocalBoard();
    } else {
      resetCurrentBoard();
    }
    await loadBoardList();
    setSyncStatus("현재 브라우저에만 저장됩니다. 실시간 공유는 config.js 설정 후 사용할 수 있습니다.");
  }

  renderAll();
}

function bindEvents() {
  elements.standardButton.addEventListener("click", toggleStandardPanel);
  elements.standardPanel.addEventListener("click", handleStandardPanelClick);
  elements.searchButton.addEventListener("click", toggleBoardSearch);
  elements.boardSearchInput.addEventListener("compositionstart", () => {
    isBoardSearchComposing = true;
  });
  elements.boardSearchInput.addEventListener("compositionend", () => {
    isBoardSearchComposing = false;
    handleBoardSearchInput();
  });
  elements.boardSearchInput.addEventListener("input", () => {
    if (isBoardSearchComposing) return;
    handleBoardSearchInput();
  });
  elements.boardSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearBoardSearch();
    }
  });
  elements.clearSearchButton.addEventListener("click", clearBoardSearch);
  elements.printButton.addEventListener("click", handlePrint);
  elements.newBoardButton.addEventListener("click", createNewBoard);
  elements.prevPourDateButton.addEventListener("click", () => shiftPourDate(-1));
  elements.nextPourDateButton.addEventListener("click", () => shiftPourDate(1));
  elements.photoTypeTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-type]");
    if (!button) return;
    setActivePhotoType(button.dataset.photoType);
  });
  window.addEventListener("popstate", () => {
    syncUrlToCurrentBoard();
  });
  elements.summaryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-summary-day]");
    if (!button) return;

    const card = elements.dayGrid.querySelector(`[data-day-card="${button.dataset.summaryDay}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  elements.boardList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-board-code]");
    if (deleteButton) {
      event.stopPropagation();
      deleteBoard(deleteButton.dataset.deleteBoardCode);
      return;
    }

    const button = event.target.closest("[data-board-code]");
    if (!button) return;
    openBoard(button.dataset.boardCode);
  });

  [elements.projectNameInput, elements.pourPartInput, elements.pourDateInput].forEach((input) => {
    input.addEventListener("input", () => {
      pullMetaFromInputs();
      saveMetaDraft();
      queueMetaSave();
      renderMetaPreview();
    });
    input.addEventListener("change", flushMetaSave);
    input.addEventListener("blur", flushMetaSave);
  });

  window.addEventListener("pagehide", () => {
    if (isFilePickerOpen) return;
    flushMetaSave();
  });
  document.addEventListener("visibilitychange", () => {
    if (isFilePickerOpen) return;
    if (document.visibilityState === "hidden") {
      flushMetaSave();
    }
  });
  window.addEventListener("focus", endFilePickSoon);

  elements.dayGrid.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".file-control")) {
      beginFilePick();
    }
  });

  elements.dayGrid.addEventListener("click", (event) => {
    if (event.target.closest(".file-control")) {
      beginFilePick();
    }
  });

  elements.dayGrid.addEventListener("change", async (event) => {
    const target = event.target;
    if (!target.matches("input[type='file']")) return;

    const day = Number(target.dataset.day);
    const photoType = normalizePhotoType(target.dataset.photoType);
    const files = Array.from(target.files || []);
    target.value = "";
    window.clearTimeout(filePickerClearTimer);
    isFilePickerOpen = false;
    if (!day || !files.length) return;

    await handlePhotoSelection(photoType, day, files);
    await flushPendingRealtimeRefresh();
  });

  elements.dayGrid.addEventListener("click", async (event) => {
    const rainButton = event.target.closest("[data-rain-day]");
    if (rainButton) {
      await toggleRainHold(Number(rainButton.dataset.rainDay));
      return;
    }

    const previewButton = event.target.closest("[data-preview-day]");
    if (previewButton) {
      openPhotoViewer(Number(previewButton.dataset.previewDay), previewButton.dataset.previewType);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-day]");
    if (!deleteButton) return;

    const day = Number(deleteButton.dataset.deleteDay);
    await deletePhoto(normalizePhotoType(deleteButton.dataset.deleteType), day);
  });

  elements.photoViewerClose.addEventListener("click", closePhotoViewer);
  elements.photoViewer.addEventListener("pointerdown", closePhotoViewerOnBackdrop);
  elements.photoViewer.addEventListener("click", closePhotoViewerOnBackdrop);
  elements.standardDocClose.addEventListener("click", closeStandardDocumentViewer);
  elements.standardDocZoomOut.addEventListener("click", () => adjustStandardDocumentZoom(-STANDARD_DOCUMENT_ZOOM_STEP));
  elements.standardDocZoomIn.addEventListener("click", () => adjustStandardDocumentZoom(STANDARD_DOCUMENT_ZOOM_STEP));
  elements.standardDocSearchInput.addEventListener("input", handleStandardDocumentSearchInput);
  elements.standardDocSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    moveToStandardDocumentSearchMatch(event.shiftKey ? -1 : 1);
  });
  elements.standardDocStage.addEventListener("scroll", handleStandardDocumentScroll, { passive: true });
  document.addEventListener("keydown", handleGlobalKeydown);
}

function toggleStandardPanel() {
  const willOpen = elements.standardPanel.hidden;
  elements.standardPanel.hidden = !willOpen;
  elements.standardButton.setAttribute("aria-expanded", String(willOpen));
}

function handleStandardPanelClick(event) {
  const button = event.target.closest("[data-standard-doc]");
  if (!button) return;
  openStandardDocumentViewer(button.dataset.standardDoc);
}

function handleGlobalKeydown(event) {
  if (!elements.photoViewer.hidden && event.key === "Escape") {
    closePhotoViewer();
    return;
  }

  if (elements.standardDocViewer.hidden) return;

  if (event.key === "Escape") {
    closeStandardDocumentViewer();
    return;
  }

  if (event.key === "+" || event.key === "=") {
    adjustStandardDocumentZoom(STANDARD_DOCUMENT_ZOOM_STEP);
    return;
  }

  if (event.key === "-") {
    adjustStandardDocumentZoom(-STANDARD_DOCUMENT_ZOOM_STEP);
  }
}

function openStandardDocumentViewer(documentKey) {
  const documentConfig = STANDARD_DOCUMENTS[documentKey];
  if (!documentConfig) return;

  activeStandardDocumentKey = documentKey;
  activeStandardDocumentPage = 1;
  standardDocumentZoom = 1;
  resetStandardDocumentSearch();
  elements.standardDocViewer.hidden = false;
  document.body.classList.add("viewer-open");
  renderStandardDocumentPage({ resetScroll: true });
  elements.standardDocClose.focus({ preventScroll: true });
}

function closeStandardDocumentViewer() {
  elements.standardDocViewer.hidden = true;
  elements.standardDocPages.replaceChildren();
  elements.standardDocPages.removeAttribute("data-document-key");
  activeStandardDocumentKey = "";
  resetStandardDocumentSearch();
  document.body.classList.remove("viewer-open");
}

function adjustStandardDocumentZoom(delta) {
  const nextZoom = clamp(
    Math.round((standardDocumentZoom + delta) / STANDARD_DOCUMENT_ZOOM_STEP) * STANDARD_DOCUMENT_ZOOM_STEP,
    STANDARD_DOCUMENT_MIN_ZOOM,
    STANDARD_DOCUMENT_MAX_ZOOM,
  );

  if (nextZoom === standardDocumentZoom) return;
  standardDocumentZoom = nextZoom;
  renderStandardDocumentZoom();
}

function renderStandardDocumentPage({ resetScroll = false, scrollToPage = false } = {}) {
  const documentConfig = getActiveStandardDocument();
  if (!documentConfig) return;

  activeStandardDocumentPage = clamp(activeStandardDocumentPage, 1, documentConfig.pages.length);
  renderStandardDocumentPages(documentConfig);
  updateStandardDocumentStatus();
  renderStandardDocumentZoom();
  renderStandardDocumentSearchState();
  preloadStandardDocumentPage(documentConfig.pages[activeStandardDocumentPage]);
  preloadStandardDocumentPage(documentConfig.pages[activeStandardDocumentPage - 2]);

  if (resetScroll || scrollToPage) {
    requestAnimationFrame(() => {
      scrollStandardDocumentPageIntoView(activeStandardDocumentPage, { behavior: "auto" });
    });
  }
}

function renderStandardDocumentPages(documentConfig) {
  if (elements.standardDocPages.dataset.documentKey === activeStandardDocumentKey) return;

  const fragment = document.createDocumentFragment();
  documentConfig.pages.forEach((page) => {
    const figure = document.createElement("figure");
    figure.className = "standard-doc-page";
    figure.dataset.standardPage = String(page.pageNumber);

    const image = document.createElement("img");
    image.className = "standard-doc-page-image";
    image.src = page.src;
    image.alt = `${documentConfig.title} ${page.pageNumber}쪽`;
    image.width = page.width;
    image.height = page.height;
    image.loading = page.pageNumber <= 2 ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;
    image.addEventListener("error", () => {
      showToast("전문 이미지를 불러오지 못했습니다.");
    });

    figure.appendChild(image);
    const highlightLayer = document.createElement("div");
    highlightLayer.className = "standard-doc-highlight-layer";
    figure.appendChild(highlightLayer);
    fragment.appendChild(figure);
  });

  elements.standardDocPages.replaceChildren(fragment);
  elements.standardDocPages.dataset.documentKey = activeStandardDocumentKey;
  renderStandardDocumentSearchHighlights();
}

function updateStandardDocumentStatus() {
  const documentConfig = getActiveStandardDocument();
  if (!documentConfig) return;

  elements.standardDocTitle.textContent = documentConfig.title;
  elements.standardDocPageLabel.textContent = `${activeStandardDocumentPage} / ${documentConfig.pages.length}쪽`;
}

function renderStandardDocumentZoom() {
  elements.standardDocZoomLabel.textContent = `${Math.round(standardDocumentZoom * 100)}%`;
  elements.standardDocZoomOut.disabled = standardDocumentZoom <= STANDARD_DOCUMENT_MIN_ZOOM;
  elements.standardDocZoomIn.disabled = standardDocumentZoom >= STANDARD_DOCUMENT_MAX_ZOOM;
  const imageWidth = standardDocumentZoom === 1 ? "min(100%, 1040px)" : `${Math.round(100 * standardDocumentZoom)}%`;
  elements.standardDocPages.style.setProperty("--standard-doc-image-width", imageWidth);
}

function getActiveStandardDocument() {
  return STANDARD_DOCUMENTS[activeStandardDocumentKey] || null;
}

function preloadStandardDocumentPage(page) {
  if (!page) return;
  const image = new Image();
  image.src = page.src;
}

function scrollStandardDocumentPageIntoView(pageNumber, { behavior = "smooth" } = {}) {
  const pageElement = elements.standardDocPages.querySelector(`[data-standard-page="${pageNumber}"]`);
  if (!pageElement) return;

  const relativePageTop = pageElement.offsetTop - elements.standardDocPages.offsetTop;
  elements.standardDocStage.scrollTo({
    left: 0,
    top: Math.max(0, relativePageTop - 8),
    behavior,
  });
}

function handleStandardDocumentScroll() {
  if (elements.standardDocViewer.hidden || standardDocumentScrollFrame) return;

  standardDocumentScrollFrame = requestAnimationFrame(() => {
    standardDocumentScrollFrame = 0;
    syncStandardDocumentPageFromScroll();
  });
}

function syncStandardDocumentPageFromScroll() {
  const documentConfig = getActiveStandardDocument();
  if (!documentConfig) return;

  const stageRect = elements.standardDocStage.getBoundingClientRect();
  const referenceY = stageRect.top + Math.min(180, elements.standardDocStage.clientHeight * 0.32);
  const pageElements = Array.from(elements.standardDocPages.querySelectorAll("[data-standard-page]"));
  let currentPage = activeStandardDocumentPage;
  let smallestDistance = Number.POSITIVE_INFINITY;

  pageElements.forEach((pageElement) => {
    const rect = pageElement.getBoundingClientRect();
    const isVisible = rect.bottom > stageRect.top + 12 && rect.top < stageRect.bottom - 12;
    if (!isVisible) return;

    const distance = Math.abs(rect.top - referenceY);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      currentPage = Number(pageElement.dataset.standardPage);
    }
  });

  if (currentPage === activeStandardDocumentPage) return;
  activeStandardDocumentPage = clamp(currentPage, 1, documentConfig.pages.length);
  updateStandardDocumentStatus();
  renderStandardDocumentSearchState();
}

function resetStandardDocumentSearch() {
  standardDocumentSearchMatches = [];
  if (elements.standardDocSearchInput) {
    elements.standardDocSearchInput.value = "";
  }
  renderStandardDocumentSearchHighlights();
  renderStandardDocumentSearchState();
}

function handleStandardDocumentSearchInput() {
  const query = elements.standardDocSearchInput.value;
  standardDocumentSearchMatches = findStandardDocumentSearchMatches(activeStandardDocumentKey, query);
  renderStandardDocumentSearchHighlights();
  renderStandardDocumentSearchState();

  if (standardDocumentSearchMatches.length) {
    const nextMatch =
      standardDocumentSearchMatches.find((match) => match.page >= activeStandardDocumentPage) ||
      standardDocumentSearchMatches[0];
    activeStandardDocumentPage = nextMatch.page;
    updateStandardDocumentStatus();
    renderStandardDocumentSearchState();
    scrollStandardDocumentPageIntoView(activeStandardDocumentPage, { behavior: "auto" });
  }
}

function findStandardDocumentSearchMatches(documentKey, query) {
  const normalizedQuery = normalizeStandardDocumentSearchText(query);
  if (!normalizedQuery) return [];

  const pages = STANDARD_DOCUMENT_SEARCH_INDEX[documentKey] || [];
  return pages
    .map((page) => ({
      page: page.page,
      boxes: findStandardDocumentSearchBoxes(page, normalizedQuery),
    }))
    .filter((match) => match.boxes.length);
}

function findStandardDocumentSearchBoxes(page, normalizedQuery) {
  const items = page.items || [];
  const normalizedText = [];
  const charMap = [];

  items.forEach((item, itemIndex) => {
    const itemChars = Array.from(String(item.text || "").normalize("NFKC").toLocaleLowerCase("ko-KR"))
      .filter((char) => !/\s/.test(char));

    itemChars.forEach((char, offset) => {
      normalizedText.push(char);
      charMap.push({
        itemIndex,
        offset,
        length: itemChars.length,
      });
    });
  });

  const haystack = normalizedText.join("");
  const boxes = [];
  let matchIndex = haystack.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    const touchedItems = new Map();
    const matchEnd = matchIndex + normalizedQuery.length;

    for (let index = matchIndex; index < matchEnd; index += 1) {
      const mapped = charMap[index];
      if (!mapped) continue;
      const itemRange = touchedItems.get(mapped.itemIndex) || {
        first: mapped.offset,
        last: mapped.offset,
        length: mapped.length,
      };
      itemRange.first = Math.min(itemRange.first, mapped.offset);
      itemRange.last = Math.max(itemRange.last, mapped.offset);
      touchedItems.set(mapped.itemIndex, itemRange);
    }

    touchedItems.forEach((range, itemIndex) => {
      const item = items[itemIndex];
      if (!item || !range.length) return;
      const characterWidth = item.w / range.length;
      boxes.push({
        x: item.x + characterWidth * range.first,
        y: item.y,
        w: Math.max(characterWidth * (range.last - range.first + 1), 0.3),
        h: item.h,
      });
    });

    matchIndex = haystack.indexOf(normalizedQuery, matchIndex + normalizedQuery.length);
  }

  return boxes;
}

function renderStandardDocumentSearchHighlights() {
  elements.standardDocPages.querySelectorAll(".standard-doc-highlight-layer").forEach((layer) => {
    layer.replaceChildren();
  });

  standardDocumentSearchMatches.forEach((match) => {
    const pageElement = elements.standardDocPages.querySelector(`[data-standard-page="${match.page}"]`);
    const layer = pageElement?.querySelector(".standard-doc-highlight-layer");
    if (!layer) return;

    const fragment = document.createDocumentFragment();
    match.boxes.forEach((box) => {
      const highlight = document.createElement("span");
      highlight.className = "standard-doc-search-highlight";
      highlight.style.left = `${box.x}%`;
      highlight.style.top = `${box.y}%`;
      highlight.style.width = `${box.w}%`;
      highlight.style.height = `${box.h}%`;
      fragment.appendChild(highlight);
    });
    layer.appendChild(fragment);
  });
}

function moveToStandardDocumentSearchMatch(direction) {
  const query = elements.standardDocSearchInput.value;
  if (!normalizeStandardDocumentSearchText(query)) return;

  if (!standardDocumentSearchMatches.length) {
    showToast("검색 결과가 없습니다.");
    return;
  }

  const orderedMatches = standardDocumentSearchMatches;
  const nextMatch =
    direction > 0
      ? orderedMatches.find((match) => match.page > activeStandardDocumentPage) || orderedMatches[0]
      : [...orderedMatches].reverse().find((match) => match.page < activeStandardDocumentPage) ||
        orderedMatches[orderedMatches.length - 1];

  activeStandardDocumentPage = nextMatch.page;
  updateStandardDocumentStatus();
  renderStandardDocumentSearchState();
  scrollStandardDocumentPageIntoView(activeStandardDocumentPage, { behavior: "auto" });
}

function renderStandardDocumentSearchState() {
  if (!elements.standardDocSearchCount) return;

  const query = elements.standardDocSearchInput?.value || "";
  const hasQuery = Boolean(normalizeStandardDocumentSearchText(query));
  const currentMatchIndex = standardDocumentSearchMatches.findIndex((match) => match.page === activeStandardDocumentPage);

  if (!hasQuery) {
    elements.standardDocSearchCount.textContent = "0건";
  } else if (!standardDocumentSearchMatches.length) {
    elements.standardDocSearchCount.textContent = "0건";
  } else if (currentMatchIndex >= 0) {
    elements.standardDocSearchCount.textContent = `${currentMatchIndex + 1}/${standardDocumentSearchMatches.length}건`;
  } else {
    elements.standardDocSearchCount.textContent = `${standardDocumentSearchMatches.length}건`;
  }

}

function normalizeStandardDocumentSearchText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "");
}

function canUseCloud() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.bucket);
}

async function setupCloudMode() {
  try {
    await ensureSupabaseClient();
    dbClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    if (state.shareCode) {
      const usedDraft = await loadCloudBoard();
      if (usedDraft) {
        await saveMeta();
      }
      await subscribeToChanges();
    } else {
      resetCurrentBoard();
    }
    await loadBoardList();
    setSyncStatus("실시간 공유 저장소에 연결되었습니다.");
  } catch (error) {
    console.error(error);
    showToast("실시간 연결에 실패해서 이 브라우저에만 저장합니다.");
    dbClient = null;
    loadLocalBoard();
    await loadBoardList();
    setSyncStatus("실시간 연결에 실패했습니다. Supabase 설정을 확인해 주세요.");
  }
}

function ensureShareCode() {
  const url = new URL(window.location.href);
  return url.searchParams.get("board") || "";
}

function syncUrlToCurrentBoard() {
  const url = new URL(window.location.href);
  if (state.shareCode) {
    url.searchParams.set("board", state.shareCode);
  } else {
    url.searchParams.delete("board");
  }
  window.history.replaceState({}, "", url.toString());
}

function createShareCode() {
  return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resetCurrentBoard(options = {}) {
  activePhotoType = DEFAULT_PHOTO_TYPE;
  const shareCode = options.keepShareCode ? state.shareCode : "";
  state = {
    shareCode,
    boardId: null,
    projectName: DEFAULT_PROJECT_NAME,
    pourPart: "",
    pourDate: toDateInputValue(new Date()),
    createdAt: "",
    entries: {},
  };
  syncInputsFromState();
}

function loadLocalBoard() {
  const shareCode = state.shareCode;
  const saved = localStorage.getItem(LOCAL_PREFIX + state.shareCode);
  state = {
    shareCode,
    boardId: null,
    projectName: DEFAULT_PROJECT_NAME,
    pourPart: "",
    pourDate: toDateInputValue(new Date()),
    createdAt: "",
    entries: {},
  };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = {
        ...state,
        ...parsed,
        shareCode,
        boardId: null,
        entries: normalizeEntries(parsed.entries || {}),
      };
      state.projectName = normalizeProjectName(state.projectName);
    } catch (error) {
      console.warn("Local board parse failed", error);
    }
  }

  if (!state.pourDate) {
    state.pourDate = toDateInputValue(new Date());
  }

  applyMetaDraft("");
  syncInputsFromState();
  saveLocalBoard();
}

async function loadCloudBoard(options = {}) {
  const requestedShareCode = state.shareCode;
  const shouldSyncInputs = options.syncInputs !== false;
  const createIfMissing = options.createIfMissing === true;
  const { data: board, error } = await dbClient
    .from("photo_boards")
    .select("*, photo_entries(*)")
    .eq("share_code", requestedShareCode)
    .maybeSingle();

  if (error) throw error;
  if (state.shareCode !== requestedShareCode) return null;

  if (board) {
    state.boardId = board.id;
    state.projectName = normalizeProjectName(board.project_name || DEFAULT_PROJECT_NAME);
    state.pourPart = board.pour_part || "";
    state.pourDate = board.pour_date || toDateInputValue(new Date());
    state.createdAt = board.created_at || "";
  } else if (createIfMissing) {
    const { data: created, error: insertError } = await dbClient
      .from("photo_boards")
      .insert({
        share_code: requestedShareCode,
        project_name: DEFAULT_PROJECT_NAME,
        pour_part: "",
        pour_date: toDateInputValue(new Date()),
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    if (state.shareCode !== requestedShareCode) return null;

    state.boardId = created.id;
    state.projectName = normalizeProjectName(created.project_name || DEFAULT_PROJECT_NAME);
    state.pourPart = created.pour_part || "";
    state.pourDate = created.pour_date || toDateInputValue(new Date());
    state.createdAt = created.created_at || "";
  } else {
    resetCurrentBoard({ keepShareCode: true });
  }

  const usedDraft = shouldSyncInputs && (board || createIfMissing) ? applyMetaDraft(board?.updated_at || "") : false;
  if (!board && !createIfMissing) {
    clearMetaDraft();
  }
  if (board?.photo_entries) {
    applyCloudEntries(board.photo_entries);
  } else {
    await loadCloudEntries();
  }
  if (shouldSyncInputs) {
    syncInputsFromState();
  }

  return usedDraft;
}

async function loadCloudEntries() {
  const requestedBoardId = state.boardId;
  state.entries = {};
  if (!requestedBoardId) return;

  const { data, error } = await dbClient
    .from("photo_entries")
    .select("*")
    .eq("board_id", requestedBoardId)
    .order("day_no", { ascending: true });

  if (error) throw error;
  if (state.boardId !== requestedBoardId) return;

  applyCloudEntries(data || []);
}

function applyCloudEntries(entries) {
  state.entries = {};
  (entries || []).forEach((row) => {
    const memo = parseEntryMemo(row.memo);
    state.entries[row.day_no] = {
      dayNo: row.day_no,
      photoUrl: row.photo_url || "",
      photoPath: row.photo_path || "",
      uploadedAt: row.uploaded_at || "",
      rainHold: memo.rainHold,
      photos: memo.photos || {},
    };
  });
}

async function loadBoardList() {
  if (dbClient) {
    await loadCloudBoardList();
  } else {
    loadLocalBoardList();
  }
  await reconcileCurrentBoardEntries();
}

async function loadCloudBoardList() {
  const range = getListRange();
  let query = dbClient
    .from("photo_boards")
    .select("id, share_code, project_name, pour_part, pour_date, created_at, updated_at, photo_entries(day_no, photo_url, memo)")
    .not("pour_date", "is", null)
    .order("pour_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (range.start) query = query.gte("pour_date", range.start);
  if (range.end) query = query.lte("pour_date", range.end);

  const { data, error } = await query;
  if (error) throw error;

  boardList = (data || []).map((board) => {
    const pourPart = board.pour_part || "미입력";
    return {
      shareCode: board.share_code,
      projectName: normalizeProjectName(board.project_name || DEFAULT_PROJECT_NAME),
      pourPart,
      searchText: normalizeSearchText(pourPart),
      pourDate: board.pour_date || "",
      createdAt: board.created_at || "",
      updatedAt: board.updated_at || "",
      completedCount: countCompletedEntries(board.photo_entries || [], PHOTO_TYPES.CURING),
      temperatureCount: countCompletedEntries(board.photo_entries || [], PHOTO_TYPES.TEMPERATURE),
      photoCount: countPhotoEntries(board.photo_entries || []),
    };
  });
}

function loadLocalBoardList() {
  const range = getListRange();
  boardList = Object.keys(localStorage)
    .filter((key) => key.startsWith(LOCAL_PREFIX) && !key.startsWith(META_DRAFT_PREFIX))
    .map((key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "{}");
        const entries = parsed.entries || {};
        const pourPart = parsed.pourPart || "미입력";
        return {
          shareCode: key.slice(LOCAL_PREFIX.length),
          projectName: normalizeProjectName(parsed.projectName || DEFAULT_PROJECT_NAME),
          pourPart,
          searchText: normalizeSearchText(pourPart),
          pourDate: parsed.pourDate || "",
          createdAt: parsed.createdAt || parsed.updatedAt || "",
          updatedAt: parsed.updatedAt || "",
          completedCount: countCompletedEntries(entries, PHOTO_TYPES.CURING),
          temperatureCount: countCompletedEntries(entries, PHOTO_TYPES.TEMPERATURE),
          photoCount: countPhotoEntries(entries),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((board) => {
      if (!board.pourDate) return false;
      if (range.start && board.pourDate < range.start) return false;
      if (range.end && board.pourDate > range.end) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCompare = (b.pourDate || "").localeCompare(a.pourDate || "");
      if (dateCompare) return dateCompare;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
}

async function reconcileCurrentBoardEntries() {
  if (!state.shareCode) return;

  const current = boardList.find((board) => board.shareCode === state.shareCode);
  if (!current) return;

  const detailCount = countCompletedEntries(state.entries || {}, PHOTO_TYPES.CURING);
  const detailPhotoCount = countPhotoEntries(state.entries || {});
  const listCount = Number(current.completedCount || 0);
  const listPhotoCount = Number(current.photoCount ?? current.completedCount ?? 0);
  if (detailCount === listCount && detailPhotoCount === listPhotoCount) return;

  if (dbClient && state.boardId) {
    await loadCloudEntries();
  } else if (!dbClient) {
    loadLocalBoard();
  }
}

function getListRange() {
  return { start: "", end: "" };
}

function countVisibleBoardPhotos() {
  return boardList.reduce((sum, board) => sum + Number(board.photoCount ?? board.completedCount ?? 0), 0);
}

async function shiftPourDate(offset) {
  const current = elements.pourDateInput.value || state.pourDate || toDateInputValue(new Date());
  const next = addDays(current, offset);
  elements.pourDateInput.value = toDateInputValue(next);
  pullMetaFromInputs();
  await saveMeta();
  renderAll();
}

async function subscribeToChanges() {
  if (!dbClient || !state.boardId) return;
  if (realtimeChannel) {
    await dbClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = dbClient
    .channel(`curing-board-${state.shareCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "photo_boards",
      },
      async (payload) => {
        if (shouldDeferRealtimeRefresh()) {
          pendingRealtimeRefresh = true;
          return;
        }

        if (payload.new?.share_code === state.shareCode || payload.old?.share_code === state.shareCode) {
          const inputFocused = isMetaInputFocused();
          await loadCloudBoard({ syncInputs: !inputFocused });
          if (inputFocused) {
            renderMetaPreview();
          } else {
            renderAll();
          }
        }
        await loadBoardList();
        renderBoardList();
        renderStorageMeter();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "photo_entries",
      },
      async (payload) => {
        if (shouldDeferRealtimeRefresh()) {
          pendingRealtimeRefresh = true;
          return;
        }

        if (payload.new?.board_id === state.boardId || payload.old?.board_id === state.boardId) {
          await loadCloudEntries();
          renderAll();
        }
        await loadBoardList();
        renderBoardList();
        renderStorageMeter();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncStatus("실시간 공유 저장소에 연결되었습니다.");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncStatus("실시간 수신이 불안정합니다. 저장은 계속 시도합니다.");
      }
    });
}

function syncInputsFromState() {
  state.projectName = normalizeProjectName(state.projectName);
  elements.projectNameInput.value = state.projectName || DEFAULT_PROJECT_NAME;
  elements.pourPartInput.value = state.pourPart || "";
  elements.pourDateInput.value = state.pourDate || "";
}

function pullMetaFromInputs() {
  state.projectName = normalizeProjectName(elements.projectNameInput.value || DEFAULT_PROJECT_NAME);
  state.pourPart = elements.pourPartInput.value;
  state.pourDate = elements.pourDateInput.value || "";
}

function queueMetaSave() {
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = window.setTimeout(saveMeta, 300);
}

function flushMetaSave() {
  pullMetaFromInputs();
  saveMetaDraft();
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  saveMeta().catch(console.error);
}

async function saveMeta() {
  pullMetaFromInputs();
  if (!state.shareCode) return;
  if (dbClient && !state.boardId) return;

  if (dbClient && state.boardId) {
    const { error } = await dbClient
      .from("photo_boards")
      .update({
        project_name: state.projectName,
        pour_part: state.pourPart,
        pour_date: state.pourDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.boardId);

    if (error) {
      console.error(error);
      showToast("사진대지 정보 저장에 실패했습니다.");
      return;
    }

    clearMetaDraft();
    await loadBoardList();
    renderBoardList();
    renderStorageMeter();
  } else {
    saveLocalBoard();
    clearMetaDraft();
    await loadBoardList();
    renderBoardList();
    renderStorageMeter();
  }
}

function saveMetaDraft() {
  try {
    localStorage.setItem(
      META_DRAFT_PREFIX + state.shareCode,
      JSON.stringify({
        projectName: state.projectName,
        pourPart: state.pourPart,
        pourDate: state.pourDate,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Meta draft save failed", error);
  }
}

function applyMetaDraft(remoteUpdatedAt) {
  try {
    const saved = localStorage.getItem(META_DRAFT_PREFIX + state.shareCode);
    if (!saved) return false;

    const draft = JSON.parse(saved);
    const draftTime = Date.parse(draft.updatedAt || "");
    const remoteTime = Date.parse(remoteUpdatedAt || "");
    if (remoteUpdatedAt && (!draftTime || draftTime <= remoteTime)) {
      clearMetaDraft();
      return false;
    }

    state.projectName = normalizeProjectName(draft.projectName || DEFAULT_PROJECT_NAME);
    state.pourPart = typeof draft.pourPart === "string" ? draft.pourPart : "";
    state.pourDate = draft.pourDate || state.pourDate || toDateInputValue(new Date());
    return true;
  } catch (error) {
    console.warn("Meta draft apply failed", error);
    clearMetaDraft();
    return false;
  }
}

function clearMetaDraft() {
  try {
    localStorage.removeItem(META_DRAFT_PREFIX + state.shareCode);
  } catch {
    // Ignore storage cleanup errors.
  }
}

async function saveEntry(day, photoType = activePhotoType) {
  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("새 대지를 먼저 만들어 주세요.");
    return false;
  }

  const saved = await persistEntry(day, photoType);
  if (!saved) return false;

  await loadBoardList();
  renderAll();
  return true;
}

async function persistEntry(day, photoType = activePhotoType) {
  const entry = getEntry(day);
  const normalizedType = normalizePhotoType(photoType);
  const slotLabel = getPhotoSlotLabel(day, normalizedType);

  if (dbClient && state.boardId) {
    let existing = null;
    try {
      existing = await loadExistingCloudEntry(day);
    } catch (error) {
      console.error(error);
      showToast(`${slotLabel} 기존 저장 정보를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.`);
      return false;
    }
    const payload = createEntryPersistPayload(day, normalizedType, entry, existing);
    const { error } = await dbClient
      .from("photo_entries")
      .upsert(
        payload,
        { onConflict: "board_id,day_no" }
      );

    if (error) {
      console.error(error);
      showToast(`${slotLabel} 저장에 실패했습니다.`);
      return false;
    }
  } else {
    return saveLocalBoard();
  }

  return true;
}

async function loadExistingCloudEntry(day) {
  if (!dbClient || !state.boardId) return null;

  const { data, error } = await dbClient
    .from("photo_entries")
    .select("photo_url, photo_path, uploaded_at, memo")
    .eq("board_id", state.boardId)
    .eq("day_no", day)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

function createEntryPersistPayload(day, photoType, entry, existing) {
  const existingMemo = parseEntryMemo(existing?.memo);
  const existingEntry = normalizeEntryShape({
    dayNo: day,
    photoUrl: existing?.photo_url || "",
    photoPath: existing?.photo_path || "",
    uploadedAt: existing?.uploaded_at || "",
    rainHold: existingMemo.rainHold,
    photos: existingMemo.photos || {},
  });

  const merged = normalizeEntryShape({
    ...existingEntry,
    ...entry,
    photos: {
      ...(existingEntry.photos || {}),
      ...(entry.photos || {}),
    },
  });

  if (photoType !== PHOTO_TYPES.CURING) {
    merged.photoUrl = existingEntry.photoUrl || entry.photoUrl || "";
    merged.photoPath = existingEntry.photoPath || entry.photoPath || "";
    merged.uploadedAt = existingEntry.uploadedAt || entry.uploadedAt || "";
    merged.rainHold = existingEntry.rainHold || entry.rainHold || false;
  }

  if (photoType === PHOTO_TYPES.CURING && existingEntry.photos?.[PHOTO_TYPES.TEMPERATURE]) {
    merged.photos[PHOTO_TYPES.TEMPERATURE] = existingEntry.photos[PHOTO_TYPES.TEMPERATURE];
  }

  return {
    board_id: state.boardId,
    day_no: day,
    photo_url: merged.photoUrl || null,
    photo_path: merged.photoPath || null,
    uploaded_at: merged.uploadedAt || null,
    memo: serializeEntryMemo(merged),
    updated_at: new Date().toISOString(),
  };
}

function saveLocalBoard() {
  if (!state.shareCode) return false;

  try {
    localStorage.setItem(
      LOCAL_PREFIX + state.shareCode,
      JSON.stringify({
        projectName: state.projectName,
        pourPart: state.pourPart,
        pourDate: state.pourDate,
        createdAt: state.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: normalizeEntries(state.entries),
      })
    );
    renderStorageMeter();
    return true;
  } catch (error) {
    console.error(error);
    showToast("브라우저 저장공간이 부족합니다. 실시간 저장소 연결이 필요합니다.");
    return false;
  }
}

async function handlePhotoUpload(photoType, day, file) {
  const normalizedType = normalizePhotoType(photoType);
  const typeConfig = getPhotoTypeConfig(normalizedType);
  const slotLabel = getPhotoSlotLabel(day, normalizedType);
  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("새 대지를 먼저 만들어 주세요.");
    return false;
  }

  if (!isImageFile(file)) {
    showToast("이미지 파일만 등록할 수 있습니다.");
    return false;
  }

  beginPhotoMutation();
  try {
    showToast(`${slotLabel} ${typeConfig.label} 사진을 압축하는 중입니다.`);
    const image = await preparePhotoEntry(normalizedType, day, file);
    const saved = await saveEntry(day, normalizedType);
    if (!saved) {
      setTypedPhoto(getEntry(day), normalizedType, image.previousPhoto);
      cleanupNewPhotoPath(image.newPath);
      return false;
    }
    cleanupOldPhotoPath(image.oldPath, image.newPath);
    showToast(`${slotLabel} ${typeConfig.label} 사진을 등록했습니다. ${formatBytes(file.size)} → ${formatBytes(image.blob.size)}`);
    return true;
  } catch (error) {
    console.error(error);
    showToast("사진 등록에 실패했습니다. 다른 사진이나 JPG 사진으로 다시 시도해 주세요.");
    return false;
  } finally {
    await endPhotoMutation();
  }
}

async function handlePhotoSelection(photoType, startDay, files) {
  const normalizedType = normalizePhotoType(photoType);
  const typeConfig = getPhotoTypeConfig(normalizedType);
  if (files.length <= 1) {
    await handlePhotoUpload(normalizedType, startDay, files[0]);
    return;
  }

  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("새 대지를 먼저 만들어 주세요.");
    return;
  }

  const imageFiles = files.filter(isImageFile);
  if (!imageFiles.length) {
    showToast("이미지 파일만 등록할 수 있습니다.");
    return;
  }

  const targetDays = days().filter((day) => day >= startDay);
  if (!targetDays.length) return;

  const maxCount = Math.min(targetDays.length, imageFiles.length);
  const overwriteCount = targetDays.slice(0, maxCount).filter((day) => hasEntryPhoto(getEntry(day), normalizedType)).length;
  if (overwriteCount) {
    const ok = window.confirm(`기존 ${typeConfig.label} 사진 ${overwriteCount}장을 새 사진으로 바꿀까요?`);
    if (!ok) return;
  }

  let completed = 0;
  let failed = 0;
  let fileIndex = 0;
  const startLabel = getPhotoSlotLabel(targetDays[0], normalizedType);
  beginPhotoMutation();
  try {
    showToast(`${startLabel}부터 ${typeConfig.label} 사진 ${maxCount}장을 등록하는 중입니다.`);
    for (const day of targetDays) {
      if (fileIndex >= imageFiles.length) break;

      let savedForDay = false;
      while (!savedForDay && fileIndex < imageFiles.length) {
        const file = imageFiles[fileIndex];
        fileIndex += 1;

        try {
          const image = await preparePhotoEntry(normalizedType, day, file);
          const saved = await persistEntry(day, normalizedType);
          if (!saved) {
            setTypedPhoto(getEntry(day), normalizedType, image.previousPhoto);
            cleanupNewPhotoPath(image.newPath);
            throw new Error(`${getPhotoSlotLabel(day, normalizedType)} 저장 실패`);
          }
          cleanupOldPhotoPath(image.oldPath, image.newPath);
          completed += 1;
          savedForDay = true;
        } catch (error) {
          console.error(error);
          failed += 1;
        }
      }
    }

    await loadBoardList();
    renderAll();

    const overflowCount = Math.max(0, imageFiles.length - targetDays.length - failed);
    const invalidCount = files.length - imageFiles.length;
    const overflowText = getOverflowPhotoText(overflowCount, normalizedType);
    const invalidText = invalidCount > 0 ? ` 이미지가 아닌 파일 ${invalidCount}개는 제외했습니다.` : "";
    const failedText = failed > 0 ? ` 처리 실패 ${failed}장은 건너뛰었습니다.` : "";
    showToast(`${startLabel}부터 ${typeConfig.label} 사진 ${completed}장 등록했습니다.${failedText}${overflowText}${invalidText}`);
  } catch (error) {
    console.error(error);
    await loadBoardList();
    renderAll();
    showToast(`${completed}장 등록 후 중단됐습니다. 실패한 사진은 다시 시도해 주세요.`);
  } finally {
    await endPhotoMutation();
  }
}

async function preparePhotoEntry(photoType, day, file) {
  const normalizedType = normalizePhotoType(photoType);
  const uploadFile = await prepareImageFile(file);
  const image = await resizeImage(uploadFile);
  const entry = getEntry(day);
  const previousPhoto = getTypedPhoto(entry, normalizedType);
  const oldPath = previousPhoto.photoPath;
  let newPath = "";
  const nextPhoto = {
    photoUrl: image.dataUrl,
    photoPath: "",
    uploadedAt: new Date().toISOString(),
    sizeBytes: image.blob.size,
  };
  setTypedPhoto(entry, normalizedType, nextPhoto);
  if (normalizedType === PHOTO_TYPES.CURING) {
    entry.rainHold = false;
  }

  if (dbClient && state.boardId) {
    const path = `${state.shareCode}/${normalizedType}/day-${day}-${Date.now()}.jpg`;
    const { error: uploadError } = await dbClient.storage
      .from(config.bucket)
      .upload(path, image.blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = dbClient.storage.from(config.bucket).getPublicUrl(path);
    setTypedPhoto(entry, normalizedType, {
      ...nextPhoto,
      photoUrl: data.publicUrl,
      photoPath: path,
    });
    newPath = path;
  }

  return {
    ...image,
    oldPath,
    newPath,
    previousPhoto,
  };
}

function cleanupOldPhotoPath(oldPath, newPath) {
  if (dbClient && oldPath && oldPath !== newPath) {
    dbClient.storage.from(config.bucket).remove([oldPath]).catch(console.error);
  }
}

function cleanupNewPhotoPath(newPath) {
  if (dbClient && newPath) {
    dbClient.storage.from(config.bucket).remove([newPath]).catch(console.error);
  }
}

async function deletePhoto(photoType, day) {
  const normalizedType = normalizePhotoType(photoType);
  const typeConfig = getPhotoTypeConfig(normalizedType);
  const slotLabel = getPhotoSlotLabel(day, normalizedType);
  const entry = getEntry(day);
  const previousPhoto = getTypedPhoto(entry, normalizedType);
  if (!previousPhoto.photoUrl) return;
  const ok = window.confirm(`${slotLabel} ${typeConfig.label} 사진을 삭제할까요?`);
  if (!ok) return;

  endFilePickNow();
  beginPhotoMutation();
  clearTypedPhoto(entry, normalizedType);
  renderAll();

  try {
    const saved = await saveEntry(day, normalizedType);
    if (!saved) {
      setTypedPhoto(entry, normalizedType, previousPhoto);
      renderAll();
      showToast(`${slotLabel} ${typeConfig.label} 사진 삭제 저장에 실패했습니다.`);
      return;
    }

    if (dbClient && previousPhoto.photoPath) {
      dbClient.storage.from(config.bucket).remove([previousPhoto.photoPath]).catch(console.error);
    }

    showToast(`${slotLabel} ${typeConfig.label} 사진을 삭제했습니다.`);
  } finally {
    await endPhotoMutation();
  }
}

async function toggleRainHold(day) {
  if (!day) return;
  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("새 대지를 먼저 만들어 주세요.");
    return;
  }

  const entry = getEntry(day);
  const previousRainHold = isRainHoldEntry(entry);
  entry.rainHold = !previousRainHold;
  renderAll();

  const saved = await saveEntry(day, PHOTO_TYPES.CURING);
  if (!saved) {
    entry.rainHold = previousRainHold;
    renderAll();
    showToast(`${day}일차 우천 설정 저장에 실패했습니다.`);
    return;
  }

  showToast(entry.rainHold ? `${day}일차를 우천 대기로 표시했습니다.` : `${day}일차 우천 대기를 해제했습니다.`);
}

function getEntry(day) {
  if (!state.entries[day]) {
    state.entries[day] = {
      dayNo: day,
      photoUrl: "",
      photoPath: "",
      uploadedAt: "",
      sizeBytes: 0,
      rainHold: false,
      photos: {},
    };
  }
  normalizeEntryShape(state.entries[day]);
  return state.entries[day];
}

function normalizePhotoType(photoType) {
  return Object.values(PHOTO_TYPES).includes(photoType) ? photoType : DEFAULT_PHOTO_TYPE;
}

function getPhotoTypeConfig(photoType = activePhotoType) {
  return PHOTO_TYPE_CONFIG[normalizePhotoType(photoType)] || PHOTO_TYPE_CONFIG[DEFAULT_PHOTO_TYPE];
}

function getPhotoSlotLabel(slot, photoType = activePhotoType) {
  const config = getPhotoTypeConfig(photoType);
  return config.slotLabel ? config.slotLabel(slot) : `${slot}일차`;
}

function getPhotoSlotDateLabel(slot, photoType = activePhotoType) {
  const config = getPhotoTypeConfig(photoType);
  return config.slotDateLabel ? config.slotDateLabel(slot) : formatDayDate(slot);
}

function getPhotoSlotCompactLabel(slot, photoType = activePhotoType) {
  const config = getPhotoTypeConfig(photoType);
  return config.slotCompactLabel ? config.slotCompactLabel(slot) : formatCompactDayDate(slot);
}

function getOverflowPhotoText(count, photoType = activePhotoType) {
  if (count <= 0) return "";
  if (normalizePhotoType(photoType) === PHOTO_TYPES.TEMPERATURE) {
    return ` ${count}장은 등록 가능한 측정 칸을 넘어 제외했습니다.`;
  }
  return ` ${count}장은 5일차를 넘어 제외했습니다.`;
}

function setActivePhotoType(photoType) {
  const nextType = normalizePhotoType(photoType);
  if (activePhotoType === nextType) {
    renderPhotoTypeControls();
    return;
  }

  activePhotoType = nextType;
  renderSummary();
  if (!isFilePickerOpen) {
    renderDayGrid();
  }
  renderPrintArea();
  renderPhotoTypeControls();
}

function renderPhotoTypeControls() {
  const configForActive = getPhotoTypeConfig(activePhotoType);
  if (elements.photoSectionTitle) {
    elements.photoSectionTitle.textContent = configForActive.sectionTitle;
  }

  elements.photoTypeTabs?.querySelectorAll("[data-photo-type]").forEach((button) => {
    const buttonPhotoType = normalizePhotoType(button.dataset.photoType);
    const selected = buttonPhotoType === activePhotoType;
    const isTemperatureButton = buttonPhotoType === PHOTO_TYPES.TEMPERATURE;
    button.setAttribute("aria-selected", String(selected));
    button.classList.toggle("active", selected);
    button.classList.toggle("temperature-stealth-tab", isTemperatureButton && !isTemperatureAccessVisible);
    button.classList.toggle("temperature-visible-tab", isTemperatureButton && isTemperatureAccessVisible);
  });
}

function loadTemperatureAccessVisible() {
  try {
    return localStorage.getItem(TEMPERATURE_VISIBILITY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setTemperatureAccessVisible(visible) {
  isTemperatureAccessVisible = Boolean(visible);
  try {
    localStorage.setItem(TEMPERATURE_VISIBILITY_STORAGE_KEY, isTemperatureAccessVisible ? "1" : "0");
  } catch {
    // 개인 표시 설정 저장 실패는 사진 저장과 별개로 조용히 무시합니다.
  }

  if (!isTemperatureAccessVisible && activePhotoType === PHOTO_TYPES.TEMPERATURE) {
    setActivePhotoType(PHOTO_TYPES.CURING);
    return;
  }

  renderPhotoTypeControls();
}

function normalizeEntryShape(entry) {
  if (!entry.photos || typeof entry.photos !== "object") {
    entry.photos = {};
  }

  if (!entry.dayNo && entry.day_no) {
    entry.dayNo = entry.day_no;
  }

  const memo = parseEntryMemo(entry.memo);
  if (memo.rainHold && entry.rainHold === undefined) {
    entry.rainHold = true;
  }

  if (memo.photos?.[PHOTO_TYPES.TEMPERATURE] && !entry.photos[PHOTO_TYPES.TEMPERATURE]) {
    entry.photos[PHOTO_TYPES.TEMPERATURE] = memo.photos[PHOTO_TYPES.TEMPERATURE];
  }

  return entry;
}

function normalizeEntries(entries) {
  Object.values(entries || {}).forEach(normalizeEntryShape);
  return entries || {};
}

function isRainHoldEntry(entry) {
  return entry?.rainHold === true || entry?.rainHold === "true";
}

function getTypedPhoto(entry, photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  const source = normalizeEntryShape(entry || {});

  if (normalizedType === PHOTO_TYPES.CURING) {
    return {
      photoUrl: source.photoUrl || source.photo_url || "",
      photoPath: source.photoPath || source.photo_path || "",
      uploadedAt: source.uploadedAt || source.uploaded_at || "",
      sizeBytes: Number(source.sizeBytes || 0),
    };
  }

  const typed = source.photos?.[normalizedType] || {};
  return {
    photoUrl: typed.photoUrl || typed.photo_url || "",
    photoPath: typed.photoPath || typed.photo_path || "",
    uploadedAt: typed.uploadedAt || typed.uploaded_at || "",
    sizeBytes: Number(typed.sizeBytes || 0),
  };
}

function setTypedPhoto(entry, photoType, photo) {
  const normalizedType = normalizePhotoType(photoType);
  normalizeEntryShape(entry);

  if (normalizedType === PHOTO_TYPES.CURING) {
    entry.photoUrl = photo.photoUrl || "";
    entry.photoPath = photo.photoPath || "";
    entry.uploadedAt = photo.uploadedAt || "";
    entry.sizeBytes = Number(photo.sizeBytes || 0);
    return;
  }

  entry.photos[normalizedType] = {
    photoUrl: photo.photoUrl || "",
    photoPath: photo.photoPath || "",
    uploadedAt: photo.uploadedAt || "",
    sizeBytes: Number(photo.sizeBytes || 0),
  };
}

function clearTypedPhoto(entry, photoType) {
  setTypedPhoto(entry, photoType, {
    photoUrl: "",
    photoPath: "",
    uploadedAt: "",
    sizeBytes: 0,
  });
}

function hasEntryPhoto(entry, photoType = PHOTO_TYPES.CURING) {
  return Boolean(getTypedPhoto(entry, photoType).photoUrl);
}

function isCompletedEntry(entry, photoType = PHOTO_TYPES.CURING) {
  if (normalizePhotoType(photoType) === PHOTO_TYPES.CURING) {
    return hasEntryPhoto(entry, PHOTO_TYPES.CURING) || isRainHoldEntry(normalizeEntryShape(entry || {})) || parseEntryMemo(entry?.memo).rainHold;
  }

  return hasEntryPhoto(entry, photoType);
}

function countCompletedEntries(entries, photoType = PHOTO_TYPES.CURING) {
  return Object.values(entries || {}).filter((entry) => isCompletedEntry(entry, photoType)).length;
}

function countPhotoEntries(entries) {
  return Object.values(entries || {}).reduce((count, entry) => {
    return count + Object.values(PHOTO_TYPES).filter((photoType) => hasEntryPhoto(entry, photoType)).length;
  }, 0);
}

function collectPhotoStoragePaths(entries) {
  const paths = [];
  Object.values(entries || {}).forEach((entry) => {
    const normalizedEntry = normalizeEntryShape({
      photoPath: entry?.photoPath || entry?.photo_path || "",
      memo: entry?.memo,
      photos: entry?.photos || {},
    });

    const curingPath = getTypedPhoto(normalizedEntry, PHOTO_TYPES.CURING).photoPath;
    if (curingPath) paths.push(curingPath);

    Object.values(PHOTO_TYPES).forEach((photoType) => {
      if (photoType === PHOTO_TYPES.CURING) return;
      const path = getTypedPhoto(normalizedEntry, photoType).photoPath;
      if (path) paths.push(path);
    });
  });

  return Array.from(new Set(paths));
}

function getEmptyPhotoText(day, photoType = activePhotoType) {
  if (normalizePhotoType(photoType) === PHOTO_TYPES.CURING && isRainHoldEntry(getEntry(day))) {
    return RAIN_HOLD_TEXT;
  }

  return getPhotoTypeConfig(photoType).missingText;
}

function getPrintMissingPhotoText(day, photoType = activePhotoType) {
  return getEmptyPhotoText(day, photoType);
}

function parseEntryMemo(memo) {
  if (!memo) return { rainHold: false, photos: {} };
  if (typeof memo === "object") {
    return normalizeEntryMemo(memo);
  }

  try {
    const parsed = JSON.parse(memo);
    return normalizeEntryMemo(parsed);
  } catch {
    return { rainHold: false, photos: {} };
  }
}

function serializeEntryMemo(entry) {
  const memo = normalizeEntryMemo({
    rainHold: isRainHoldEntry(entry),
    photos: entry?.photos || {},
  });
  const hasPhotos = Object.values(memo.photos || {}).some((photo) => Boolean(photo?.photoUrl || photo?.photoPath));
  if (!memo.rainHold && !hasPhotos) return "";
  return JSON.stringify(memo);
}

function normalizeEntryMemo(memo) {
  const normalized = {
    rainHold: memo?.rainHold === true || memo?.rainHold === "true",
    photos: {},
  };

  const temperature = memo?.photos?.[PHOTO_TYPES.TEMPERATURE] || memo?.temperature || memo?.temperaturePhoto || {};
  const photoUrl = temperature.photoUrl || temperature.photo_url || memo?.temperaturePhotoUrl || "";
  const photoPath = temperature.photoPath || temperature.photo_path || memo?.temperaturePhotoPath || "";
  const uploadedAt = temperature.uploadedAt || temperature.uploaded_at || memo?.temperatureUploadedAt || "";
  const sizeBytes = Number(temperature.sizeBytes || memo?.temperatureSizeBytes || 0);

  if (photoUrl || photoPath || uploadedAt || sizeBytes) {
    normalized.photos[PHOTO_TYPES.TEMPERATURE] = {
      photoUrl,
      photoPath,
      uploadedAt,
      sizeBytes,
    };
  }

  return normalized;
}

function renderAll() {
  renderPhotoTypeControls();
  renderBoardList();
  renderSummary();
  if (!isFilePickerOpen) {
    renderDayGrid();
  }
  renderPrintArea();
  renderStorageMeter();
}

function renderMetaPreview() {
  renderPhotoTypeControls();
  renderSummary();
  if (!isFilePickerOpen) {
    renderDayGrid();
  }
  renderPrintArea();
}

function beginFilePick() {
  window.clearTimeout(filePickerClearTimer);
  isFilePickerOpen = true;
  filePickerClearTimer = window.setTimeout(() => {
    isFilePickerOpen = false;
    flushPendingRealtimeRefresh();
  }, 120000);
}

function endFilePickSoon() {
  window.clearTimeout(filePickerClearTimer);
  filePickerClearTimer = window.setTimeout(() => {
    isFilePickerOpen = false;
    flushPendingRealtimeRefresh();
  }, 800);
}

function endFilePickNow() {
  window.clearTimeout(filePickerClearTimer);
  isFilePickerOpen = false;
}

function beginPhotoMutation() {
  activePhotoMutationCount += 1;
}

async function endPhotoMutation() {
  activePhotoMutationCount = Math.max(0, activePhotoMutationCount - 1);
  await flushPendingRealtimeRefresh();
}

function shouldDeferRealtimeRefresh() {
  return isFilePickerOpen || activePhotoMutationCount > 0;
}

async function flushPendingRealtimeRefresh() {
  if (!pendingRealtimeRefresh || shouldDeferRealtimeRefresh() || !dbClient) return;
  pendingRealtimeRefresh = false;

  try {
    const inputFocused = isMetaInputFocused();
    await loadCloudBoard({ syncInputs: !inputFocused });
    await loadCloudEntries();
    await loadBoardList();
    if (inputFocused) {
      renderMetaPreview();
    } else {
      renderAll();
    }
    renderStorageMeter();
  } catch (error) {
    console.error(error);
    pendingRealtimeRefresh = true;
  }
}

function renderBoardList() {
  cancelScheduledBoardListRender();

  const visibleBoards = getVisibleBoardList();
  if (!visibleBoards.length) {
    const isSearching = Boolean(normalizeSearchText(boardSearchQuery));
    elements.boardList.innerHTML = `
      <div class="empty-list">
        ${isSearching ? "검색 결과가 없습니다." : "등록된 사진대지가 없습니다."}
      </div>
    `;
    return;
  }

  elements.boardList.innerHTML = visibleBoards
    .map((board) => {
      const active = board.shareCode === state.shareCode;
      const curingCount = Number(board.completedCount || 0);
      const temperatureCount = Number(board.temperatureCount || 0);
      return `
        <div class="board-list-item ${active ? "active" : ""}" data-board-code="${escapeAttribute(board.shareCode)}">
          <span class="board-date">${escapeHtml(formatListDate(board.pourDate))}</span>
          <span class="board-part">${escapeHtml(board.pourPart)}</span>
          <span class="board-counts">
            <span class="board-count ${curingCount === DAY_COUNT ? "complete" : ""}">${curingCount}/${DAY_COUNT} 양생</span>
            ${
              temperatureCount > 0
                ? `<span class="board-count temperature">${temperatureCount}장 측정</span>`
                : ""
            }
          </span>
          <button class="board-delete-button" type="button" data-delete-board-code="${escapeAttribute(board.shareCode)}" title="사진대지 삭제">×</button>
        </div>
      `;
    })
    .join("");
}

function getVisibleBoardList() {
  const query = normalizeSearchText(boardSearchQuery);
  if (!query) return boardList;

  return boardList.filter((board) => (board.searchText || normalizeSearchText(board.pourPart)).includes(query));
}

function scheduleBoardListRender() {
  cancelScheduledBoardListRender();
  const schedule = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (callback) => window.setTimeout(callback, 16);
  boardListRenderFrame = schedule(() => {
    boardListRenderFrame = 0;
    renderBoardList();
  });
}

function cancelScheduledBoardListRender() {
  if (!boardListRenderFrame) return;
  if (window.cancelAnimationFrame) {
    window.cancelAnimationFrame(boardListRenderFrame);
  } else {
    window.clearTimeout(boardListRenderFrame);
  }
  boardListRenderFrame = 0;
}

function toggleBoardSearch() {
  const willOpen = elements.boardSearchBar.hidden;
  elements.boardSearchBar.hidden = !willOpen;
  elements.searchButton.setAttribute("aria-expanded", String(willOpen));

  if (willOpen) {
    elements.boardSearchInput.focus();
    elements.boardSearchInput.select();
    return;
  }

  if (boardSearchQuery) {
    boardSearchQuery = "";
    elements.boardSearchInput.value = "";
    renderBoardList();
  }
  elements.boardSearchInput.blur();
}

function clearBoardSearch() {
  boardSearchQuery = "";
  elements.boardSearchInput.value = "";
  renderBoardList();
  elements.boardSearchInput.focus();
}

function handleBoardSearchInput() {
  const value = elements.boardSearchInput.value;
  if (applyTemperatureAccessCode(value)) return;

  boardSearchQuery = value;
  scheduleBoardListRender();
}

function applyTemperatureAccessCode(value) {
  const code = String(value || "").trim();
  if (code !== TEMPERATURE_SHOW_CODE && code !== TEMPERATURE_HIDE_CODE) return false;

  const willShow = code === TEMPERATURE_SHOW_CODE;
  setTemperatureAccessVisible(willShow);
  boardSearchQuery = "";
  elements.boardSearchInput.value = "";
  renderBoardList();
  showToast(willShow ? "이 기기에서 온도측정 버튼을 표시합니다." : "이 기기에서 온도측정 버튼을 숨깁니다.");
  return true;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "");
}

function renderSummary() {
  const photoType = activePhotoType;
  elements.summaryList.innerHTML = days()
    .map((day) => {
      const entry = getEntry(day);
      const hasPhoto = hasEntryPhoto(entry, photoType);
      const rainHold = photoType === PHOTO_TYPES.CURING && isRainHoldEntry(entry);
      const slotLabel = getPhotoSlotLabel(day, photoType);
      const statusText = hasPhoto ? "등록" : rainHold ? "우천대기" : "미등록";
      return `
        <button class="summary-item ${hasPhoto ? "done" : ""} ${rainHold ? "rain-hold" : ""}" type="button" data-summary-day="${day}">
          <strong>${escapeHtml(slotLabel)}</strong>
          <small>${escapeHtml(getPhotoSlotCompactLabel(day, photoType))}</small>
          <span class="summary-status">${statusText}</span>
        </button>
      `;
    })
    .join("");
}

async function renderStorageMeter() {
  if (!elements.storageMeterText || !elements.storageMeterBar) return;

  const usage = getKnownPhotoBytes();
  const quota = getStorageDisplayLimitBytes();
  const percent = quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
  elements.storageMeterText.textContent = `${formatBytes(usage)} / ${formatBytes(quota)}`;
  elements.storageMeterBar.style.width = `${percent}%`;
  elements.storageMeterBar.classList.toggle("warn", percent >= 80);
}

function renderDayGrid() {
  const photoType = activePhotoType;
  const typeConfig = getPhotoTypeConfig(photoType);
  elements.dayGrid.innerHTML = days()
    .map((day) => {
      const entry = getEntry(day);
      const photo = getTypedPhoto(entry, photoType);
      const hasPhoto = Boolean(photo.photoUrl);
      const rainHold = photoType === PHOTO_TYPES.CURING && isRainHoldEntry(entry);
      const emptyPhotoText = getEmptyPhotoText(day, photoType);
      const slotLabel = getPhotoSlotLabel(day, photoType);
      const slotDateLabel = getPhotoSlotDateLabel(day, photoType);
      return `
        <article class="day-card ${hasPhoto ? "complete" : ""} ${rainHold ? "rain-hold" : ""}" data-day-card="${day}">
          <div class="day-card-header">
            <h3>${escapeHtml(slotLabel)}</h3>
            ${
              photoType === PHOTO_TYPES.CURING
                ? `<button class="rain-toggle ${rainHold ? "active" : ""}" type="button" data-rain-day="${day}" aria-pressed="${rainHold}" title="${day}일차 우천 대기 표시" aria-label="${day}일차 우천 대기 표시">
                    <span aria-hidden="true">☔</span>
                  </button>`
                : ""
            }
            <span class="date-pill">${escapeHtml(slotDateLabel)}</span>
          </div>
          <div class="photo-preview">
            ${
              hasPhoto
                ? `<button class="photo-preview-button" type="button" data-preview-day="${day}" data-preview-type="${escapeAttribute(photoType)}" title="${escapeAttribute(slotLabel)} 사진 크게 보기">
                    <img src="${escapeAttribute(photo.photoUrl)}" alt="${escapeAttribute(slotLabel)} ${escapeAttribute(typeConfig.label)} 사진" loading="lazy" decoding="async">
                  </button>`
                : `<div class="empty-photo ${rainHold ? "rain-hold" : ""}"><span>${escapeHtml(emptyPhotoText)}</span></div>`
            }
          </div>
          <div class="day-card-body">
            <div class="upload-row">
              <div class="file-control">
                <label class="file-control-title" for="camera-${day}">▣ 촬영</label>
                <input id="camera-${day}" class="file-input" data-day="${day}" data-photo-type="${escapeAttribute(photoType)}" type="file" accept="image/*" capture="environment" aria-label="${escapeAttribute(slotLabel)} ${escapeAttribute(typeConfig.label)} 사진 촬영">
              </div>
              <div class="file-control">
                <label class="file-control-title" for="gallery-${day}">＋ 첨부</label>
                <input id="gallery-${day}" class="file-input" data-day="${day}" data-photo-type="${escapeAttribute(photoType)}" type="file" accept="image/*" multiple aria-label="${escapeAttribute(slotLabel)} ${escapeAttribute(typeConfig.label)} 사진 첨부">
              </div>
              ${
                hasPhoto
                  ? `<button class="small-button danger-button" type="button" data-delete-day="${day}" data-delete-type="${escapeAttribute(photoType)}">
                      <span class="button-icon" aria-hidden="true">×</span>
                      <span>삭제</span>
                    </button>`
                  : ""
              }
            </div>
            ${hasPhoto ? `<div class="uploaded-meta">${renderUploadedMeta(photo)}</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPrintArea() {
  const signature = getPrintImageSignature();
  const token = ++printPreviewRenderToken;

  window.clearTimeout(printPreviewTimer);

  if (printImageCache.signature === signature && Array.isArray(printImageCache.images)) {
    renderPrintPreviewImages(printImageCache.images);
    return;
  }

  elements.printArea.innerHTML = `<div class="print-render-loading">출력 미리보기 준비 중</div>`;
  printPreviewTimer = window.setTimeout(async () => {
    try {
      const images = await getPrintPageImages();
      if (token !== printPreviewRenderToken) return;
      renderPrintPreviewImages(images);
    } catch (error) {
      console.error(error);
      if (token !== printPreviewRenderToken) return;
      elements.printArea.innerHTML = `<div class="print-render-loading">출력 미리보기를 만들지 못했습니다.</div>`;
    }
  }, 80);
}

function renderPrintPreviewImages(images) {
  if (!images.length) {
    elements.printArea.innerHTML = `<div class="print-render-loading">${escapeHtml(getPhotoTypeConfig(activePhotoType).sectionTitle)} 미등록</div>`;
    return;
  }

  elements.printArea.innerHTML = images
    .map((src, index) => {
      return `<img class="print-raster-page" src="${escapeAttribute(src)}" alt="사진대지 ${index + 1}쪽">`;
    })
    .join("");
}

function getPrintTextLengthScore(text) {
  return Array.from(String(text)).reduce((score, char) => {
    return score + (char.charCodeAt(0) <= 0x7f ? 0.55 : 1);
  }, 0);
}

function renderUploadedMeta(photo) {
  if (!photo.photoUrl) return "";
  const time = photo.uploadedAt ? formatDateTime(photo.uploadedAt) : "";
  return time ? `등록 ${escapeHtml(time)} · 자동 압축` : "자동 압축";
}

function openPhotoViewer(day, photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  const typeConfig = getPhotoTypeConfig(normalizedType);
  const photo = getTypedPhoto(getEntry(day), normalizedType);
  if (!photo.photoUrl) return;

  elements.photoViewerImage.src = photo.photoUrl;
  elements.photoViewerImage.alt = `${getPhotoSlotLabel(day, normalizedType)} ${typeConfig.label} 사진`;
  elements.photoViewer.hidden = false;
  document.body.classList.add("viewer-open");
}

function closePhotoViewerOnBackdrop(event) {
  if (event.target === elements.photoViewer) {
    closePhotoViewer();
  }
}

function closePhotoViewer() {
  elements.photoViewer.hidden = true;
  elements.photoViewerImage.removeAttribute("src");
  elements.photoViewerImage.alt = "";
  document.body.classList.remove("viewer-open");
}

function getPrintImageSignature() {
  const photoType = activePhotoType;
  const printSlots = getPrintSlots(photoType);
  const entries = days().map((day) => {
    const entry = getEntry(day);
    const photo = getTypedPhoto(entry, photoType);
    return [day, photo.photoUrl || "", photo.uploadedAt || "", photoType === PHOTO_TYPES.CURING && isRainHoldEntry(entry)];
  });

  return JSON.stringify({
    photoType,
    projectName: state.projectName || "",
    pourPart: state.pourPart || "",
    pourDate: state.pourDate || "",
    printSlots,
    entries,
  });
}

function getPrintSlots(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  if (normalizedType === PHOTO_TYPES.CURING) return days();

  return days().filter((day) => hasEntryPhoto(getEntry(day), normalizedType));
}

function getPrintPageGroups(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  if (normalizedType === PHOTO_TYPES.CURING) return PRINT_PAGE_GROUPS;

  const slots = getPrintSlots(normalizedType);
  const groups = [];
  for (let index = 0; index < slots.length; index += 2) {
    groups.push([slots[index], slots[index + 1] || null]);
  }
  return groups;
}

async function getPrintPageImages() {
  const signature = getPrintImageSignature();
  if (printImageCache.signature === signature && Array.isArray(printImageCache.images)) {
    return printImageCache.images;
  }

  const photoType = activePhotoType;
  const groups = getPrintPageGroups(photoType);
  const photos = await loadPrintPhotos(photoType);
  const images = groups.map((group) => createPrintPageImage(group, photos, photoType));
  printImageCache = { signature, images };
  return images;
}

async function loadPrintPhotos(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  const slots = getPrintSlots(normalizedType);
  const photoPairs = await Promise.all(
    slots.map(async (day) => {
      const photoUrl = getTypedPhoto(getEntry(day), normalizedType).photoUrl;
      if (!photoUrl) return [day, null];
      const image = await loadPrintPhoto(photoUrl);
      return [day, image];
    })
  );

  return Object.fromEntries(photoPairs);
}

function loadPrintPhoto(src) {
  return new Promise((resolve) => {
    const image = new Image();
    if (!String(src).startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function createPrintPageImage(group, photos, photoType = activePhotoType) {
  let canvas = drawPrintPage(group, photos, true, photoType);
  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Photo canvas export failed. Retrying without photos.", error);
    canvas = drawPrintPage(group, photos, false, photoType);
    return canvas.toDataURL("image/png");
  }
}

function printMm(value) {
  return value * PRINT_MM_SCALE;
}

function printPt(value) {
  return value * (96 / 72) * (PRINT_MM_SCALE / (96 / 25.4));
}

function drawPrintPage(group, photos, allowPhotos, photoType = activePhotoType) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(printMm(PRINT_PAGE_WIDTH_MM));
  canvas.height = Math.round(printMm(PRINT_PAGE_HEIGHT_MM));

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPrintTitle(ctx);
  drawPrintProjectName(ctx);
  drawPrintTable(ctx, group, photos, allowPhotos, photoType);

  return canvas;
}

function drawPrintTitle(ctx) {
  const pageWidth = printMm(PRINT_PAGE_WIDTH_MM);
  const titleY = printMm(15);
  const fontPx = printPt(22);

  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.font = `900 ${fontPx}px "HYHeadLine-M", "Malgun Gothic", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("사 진 대 지", pageWidth / 2, titleY);

  const metrics = ctx.measureText("사 진 대 지");
  const underlineY = titleY + fontPx + printMm(1);
  ctx.lineWidth = printMm(0.45);
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(pageWidth / 2 - metrics.width / 2, underlineY);
  ctx.lineTo(pageWidth / 2 + metrics.width / 2, underlineY);
  ctx.stroke();
  ctx.restore();
}

function drawPrintProjectName(ctx) {
  const tableX = printMm((PRINT_PAGE_WIDTH_MM - PRINT_TABLE_WIDTH_MM) / 2);
  const titleHeightMm = 22 * 25.4 / 72;
  const tableY = printMm(15 + titleHeightMm + 16.9);
  const text = `□ ${normalizeProjectName(state.projectName || DEFAULT_PROJECT_NAME)}`;
  const fontPx = printPt(11);
  const textY = tableY - printMm(5.8);

  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.font = `${fontPx}px "Batang", "HCR Batang", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(fitPrintCanvasText(ctx, text, printMm(PRINT_TABLE_WIDTH_MM)), tableX, textY);
  ctx.restore();
}

function drawPrintTable(ctx, group, photos, allowPhotos, photoType = activePhotoType) {
  const tableX = printMm((PRINT_PAGE_WIDTH_MM - PRINT_TABLE_WIDTH_MM) / 2);
  const titleHeightMm = 22 * 25.4 / 72;
  const tableY = printMm(15 + titleHeightMm + 16.9);
  const blockHeight = printMm(PRINT_TABLE_HEIGHT_MM / 2);

  group.forEach((day, index) => {
    drawPrintBlockCanvas(ctx, day, tableX, tableY + blockHeight * index, photos, allowPhotos, photoType);
  });
}

function drawPrintBlockCanvas(ctx, day, x, y, photos, allowPhotos, photoType = activePhotoType) {
  const tableW = printMm(PRINT_TABLE_WIDTH_MM);
  const labelW = printMm(PRINT_LABEL_WIDTH_MM);
  const mainW = printMm(PRINT_MAIN_WIDTH_MM);
  const dayW = printMm(PRINT_DAY_WIDTH_MM);
  const photoH = printMm(PRINT_PHOTO_ROW_HEIGHT_MM);
  const infoH = printMm(PRINT_INFO_ROW_HEIGHT_MM);
  const contentH = printMm(PRINT_INFO_ROW_HEIGHT_MM);
  const infoY = y + photoH;
  const contentY = infoY + infoH;

  drawPrintCell(ctx, x, y, tableW, photoH);
  drawPrintCell(ctx, x, infoY, labelW, infoH);
  drawPrintCell(ctx, x + labelW, infoY, mainW, infoH);
  drawPrintCell(ctx, x + labelW + mainW, infoY, dayW, infoH);
  drawPrintCell(ctx, x, contentY, labelW, contentH);
  drawPrintCell(ctx, x + labelW, contentY, mainW + dayW, contentH);

  if (!day) return;

  drawPrintPhoto(ctx, day, x, y, tableW, photoH, photos[day], allowPhotos, photoType);
  drawCenteredPrintText(ctx, "위  치", x, infoY, labelW, infoH, 13, "Batang, serif");
  drawPrintMainTextCanvas(ctx, state.pourPart || "", x + labelW, infoY, mainW, infoH, {
    breakAfterFirstBracket: true,
  });
  drawCenteredPrintText(ctx, getPhotoSlotLabel(day, photoType), x + labelW + mainW, infoY, dayW, infoH, 13, "Batang, serif");
  drawCenteredPrintText(ctx, "내  용", x, contentY, labelW, contentH, 13, "Batang, serif");
  drawPrintMainTextCanvas(ctx, getPhotoTypeConfig(photoType).contentText, x + labelW, contentY, mainW + dayW, contentH);
}

function drawPrintCell(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, printMm(0.12));
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawPrintPhoto(ctx, day, x, y, width, height, image, allowPhotos, photoType = activePhotoType) {
  const photoW = printMm(PRINT_PHOTO_WIDTH_MM);
  const photoH = printMm(PRINT_PHOTO_HEIGHT_MM);
  const photoX = x + (width - photoW) / 2;
  const photoY = y + (height - photoH) / 2;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(photoX, photoY, photoW, photoH);

  if (allowPhotos && image) {
    drawCoverImage(ctx, image, photoX, photoY, photoW, photoH);
  } else {
    drawCenteredPrintText(ctx, getPrintMissingPhotoText(day, photoType), photoX, photoY, photoW, photoH, 13, "Batang, serif");
  }

  ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function drawCenteredPrintText(ctx, text, x, y, width, height, fontPt, fontFamily) {
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.font = `${printPt(fontPt)}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.restore();
}

function drawPrintMainTextCanvas(ctx, text, x, y, width, height, options = {}) {
  const paddingX = printMm(1.8);
  const fontPt = getPrintCanvasFontPt(text);
  const fontPx = printPt(fontPt);
  const lineHeight = fontPx * 1.12;
  const textX = x + paddingX;
  const textWidth = width - paddingX * 2;

  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.font = `${fontPx}px "Batang", "HCR Batang", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const lines = getPrintCanvasLines(ctx, text, textWidth, 2, options);
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, textX, startY + index * lineHeight);
  });

  ctx.restore();
}

function getPrintCanvasFontPt(text) {
  const lengthScore = getPrintTextLengthScore(text);
  if (lengthScore > 70) return 10;
  if (lengthScore > 52) return 11.5;
  return 13;
}

function getPrintCanvasLines(ctx, value, maxWidth, maxLines, options = {}) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [""];

  const segments = getPrintCanvasSegments(text, options);
  const lines = [];

  segments.forEach((segment) => {
    if (lines.length >= maxLines) return;
    wrapPrintCanvasSegment(ctx, segment, maxWidth).forEach((line) => {
      if (lines.length < maxLines) {
        lines.push(line);
      }
    });
  });

  if (!lines.length) return [""];

  const hasHiddenText = segments.join(" ").length > lines.join(" ").length;
  if (hasHiddenText && lines.length >= maxLines) {
    lines[maxLines - 1] = fitPrintCanvasText(ctx, lines[maxLines - 1], maxWidth, "…");
  }

  return lines.slice(0, maxLines);
}

function getPrintCanvasSegments(text, options = {}) {
  if (!options.breakAfterFirstBracket || getPrintTextLengthScore(text) <= 18) {
    return [text];
  }

  const chars = Array.from(text);
  const breakIndex = chars.findIndex((char, index) => {
    return [")", "]", "}"].includes(char) && index < chars.length - 1;
  });

  if (breakIndex < 0) return [text];
  return [
    chars.slice(0, breakIndex + 1).join("").trim(),
    chars.slice(breakIndex + 1).join("").trim(),
  ].filter(Boolean);
}

function wrapPrintCanvasSegment(ctx, segment, maxWidth) {
  if (ctx.measureText(segment).width <= maxWidth) return [segment];

  const tokens = segment.split(/(\s+)/).filter(Boolean);
  const lines = [];
  let line = "";

  tokens.forEach((token) => {
    const candidate = `${line}${token}`;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }

    lines.push(fitPrintCanvasText(ctx, line.trim(), maxWidth));
    line = token.trimStart();
  });

  if (line) {
    lines.push(fitPrintCanvasText(ctx, line.trim(), maxWidth));
  }

  return lines;
}

function fitPrintCanvasText(ctx, text, maxWidth, suffix = "") {
  let chars = Array.from(String(text || ""));
  while (chars.length && ctx.measureText(`${chars.join("")}${suffix}`).width > maxWidth) {
    chars.pop();
  }
  return `${chars.join("")}${suffix}`;
}

async function handlePrint() {
  if (isKakaoInAppBrowser()) {
    showToast("카톡 안에서는 인쇄가 막힐 수 있습니다. 브라우저로 열어서 인쇄해 주세요.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("새 창이 차단됐습니다. 팝업을 허용한 뒤 PDF를 다시 눌러 주세요.");
    return;
  }

  writePrintLoadingDocument(printWindow);
  elements.printButton.disabled = true;
  showToast("출력 이미지를 준비하는 중입니다.");
  try {
    const images = await getPrintPageImages();
    if (!images.length) {
      printWindow.close();
      showToast(`${getPhotoTypeConfig(activePhotoType).sectionTitle}이 없습니다.`);
      return;
    }
    writeRasterPrintDocument(printWindow, images);
  } catch (error) {
    console.error(error);
    printWindow.close();
    showToast("출력 이미지를 만들지 못했습니다.");
  } finally {
    elements.printButton.disabled = false;
  }
}

function writePrintLoadingDocument(printWindow) {
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta name="color-scheme" content="light">
        <title>PDF 출력 준비</title>
        <style>
          html, body { margin: 0; background: #fff; color: #000; color-scheme: light; }
          body { display: grid; min-height: 100vh; place-items: center; font-family: sans-serif; }
        </style>
      </head>
      <body>출력 이미지를 준비하는 중입니다.</body>
    </html>`);
  printWindow.document.close();
}

function writeRasterPrintDocument(printWindow, images) {
  const pages = images
    .map((src, index) => `<img class="page" src="${escapeAttribute(src)}" alt="사진대지 ${index + 1}쪽">`)
    .join("");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta name="color-scheme" content="light">
        <meta name="darkreader-lock">
        <title>사진대지 PDF 출력</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff !important;
            color: #000 !important;
            color-scheme: light;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            display: block;
            width: 210mm;
            height: 297mm;
            margin: 0;
            background: #fff !important;
            page-break-after: always;
            break-after: page;
            filter: none !important;
            mix-blend-mode: normal !important;
          }
          .page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          @media screen {
            body {
              display: grid;
              gap: 12px;
              justify-content: center;
              padding: 12px;
            }
            .page {
              border: 1px solid #ddd;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            }
          }
        </style>
      </head>
      <body>
        ${pages}
        <script>
          (() => {
            const images = Array.from(document.images);
            let remaining = images.length;
            const start = () => setTimeout(() => {
              window.focus();
              window.print();
            }, 100);
            const done = () => {
              remaining -= 1;
              if (remaining <= 0) start();
            };
            if (!remaining) {
              start();
              return;
            }
            images.forEach((image) => {
              if (image.complete) {
                done();
              } else {
                image.onload = done;
                image.onerror = done;
              }
            });
          })();
        </script>
      </body>
    </html>`);
  printWindow.document.close();
}

async function createNewBoard() {
  if (activePhotoMutationCount > 0) {
    showToast("사진 등록이 끝난 뒤 새 사진대지를 만들어 주세요.");
    return;
  }

  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  boardLoadToken += 1;
  activePhotoType = DEFAULT_PHOTO_TYPE;

  const url = new URL(window.location.href);
  const shareCode = createShareCode();
  url.searchParams.set("board", shareCode);
  window.history.replaceState({}, "", url.toString());

  state = {
    shareCode,
    boardId: null,
    projectName: DEFAULT_PROJECT_NAME,
    pourPart: "",
    pourDate: toDateInputValue(new Date()),
    entries: {},
  };

  if (dbClient) {
    await loadCloudBoard({ createIfMissing: true });
    await subscribeToChanges();
  } else {
    syncInputsFromState();
    saveLocalBoard();
  }

  await loadBoardList();
  renderAll();
  showToast("새 사진대지를 만들었습니다.");
}

async function openBoard(shareCode) {
  if (!shareCode) return;
  if (activePhotoMutationCount > 0) {
    showToast("사진 등록이 끝난 뒤 다른 타설부위를 열어 주세요.");
    return;
  }

  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  activePhotoType = DEFAULT_PHOTO_TYPE;
  if (state.shareCode && shareCode !== state.shareCode) {
    await saveMeta();
  }

  const token = ++boardLoadToken;
  const selectedBoard = boardList.find((board) => board.shareCode === shareCode);
  const url = new URL(window.location.href);
  url.searchParams.set("board", shareCode);
  window.history.replaceState({}, "", url.toString());
  state = {
    shareCode,
    boardId: null,
    projectName: selectedBoard?.projectName || DEFAULT_PROJECT_NAME,
    pourPart: selectedBoard?.pourPart || "",
    pourDate: selectedBoard?.pourDate || toDateInputValue(new Date()),
    createdAt: selectedBoard?.createdAt || "",
    entries: {},
  };
  syncInputsFromState();
  closePhotoViewer();
  renderAll();

  if (dbClient) {
    const loaded = await loadCloudBoard();
    if (loaded === null || token !== boardLoadToken || state.shareCode !== shareCode) return;
    await subscribeToChanges();
  } else {
    loadLocalBoard();
  }

  if (token !== boardLoadToken || state.shareCode !== shareCode) return;
  await loadBoardList();
  if (token !== boardLoadToken || state.shareCode !== shareCode) return;
  renderAll();
}

async function deleteBoard(shareCode) {
  if (!shareCode) return;
  const ok = window.confirm("이 사진대지를 목록에서 삭제할까요?");
  if (!ok) return;

  const target = boardList.find((board) => board.shareCode === shareCode);
  boardList = boardList.filter((board) => board.shareCode !== shareCode);
  renderBoardList();

  if (dbClient) {
    const { data: board, error } = await dbClient
      .from("photo_boards")
      .select("id, photo_entries(photo_path, memo)")
      .eq("share_code", shareCode)
      .maybeSingle();

    if (error) {
      console.error(error);
      showToast("사진대지 삭제에 실패했습니다.");
      await loadBoardList();
      renderBoardList();
      return;
    }

    if (board?.id) {
      const { error: boardError } = await dbClient.from("photo_boards").delete().eq("id", board.id);
      if (boardError) {
        console.error(boardError);
        const hidden = await hideBoardFromList(shareCode);
        if (!hidden) {
          showToast("사진대지 삭제에 실패했습니다.");
          await loadBoardList();
          renderBoardList();
          return;
        }
      } else {
        const { data: remains, error: remainsError } = await dbClient
          .from("photo_boards")
          .select("id")
          .eq("share_code", shareCode)
          .maybeSingle();

        if (remainsError) {
          console.error(remainsError);
        }

        if (remains?.id) {
          const hidden = await hideBoardFromList(shareCode);
          if (!hidden) {
            showToast("사진대지를 목록에서 숨기지 못했습니다.");
            await loadBoardList();
            renderBoardList();
            return;
          }
        }
      }

      const paths = collectPhotoStoragePaths(board.photo_entries || []);
      if (paths.length) {
        dbClient.storage.from(config.bucket).remove(paths).catch(console.error);
      }
    }
  } else {
    localStorage.removeItem(LOCAL_PREFIX + shareCode);
    localStorage.removeItem(META_DRAFT_PREFIX + shareCode);
  }

  try {
    localStorage.removeItem(META_DRAFT_PREFIX + shareCode);
  } catch {
    // Ignore storage cleanup errors.
  }

  showToast(`${target?.pourPart || "사진대지"}를 삭제했습니다.`);

  await loadBoardList();

  if (shareCode === state.shareCode) {
    await openNextBoardAfterDelete();
    return;
  }

  renderBoardList();
  renderStorageMeter();
}

async function openNextBoardAfterDelete() {
  const nextBoard = boardList.find((board) => board.shareCode !== state.shareCode);
  if (nextBoard) {
    await openBoard(nextBoard.shareCode);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("board");
  window.history.replaceState({}, "", url.toString());

  resetCurrentBoard();
  renderAll();
  showToast("삭제했습니다. 새 대지를 누르면 새 사진대지가 만들어집니다.");
}

async function hideBoardFromList(shareCode) {
  const { error } = await dbClient
    .from("photo_boards")
    .update({
      pour_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("share_code", shareCode);

  if (error) {
    console.error(error);
    return false;
  }

  return true;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function setSyncStatus(message) {
  if (elements.syncStatus) {
    elements.syncStatus.textContent = message;
  }
}

function isMetaInputFocused() {
  return [elements.projectNameInput, elements.pourPartInput, elements.pourDateInput].includes(document.activeElement);
}

function getKnownPhotoBytes() {
  const listPhotoCount = countVisibleBoardPhotos();
  const currentPhotoCount = countPhotoEntries(state.entries || {});
  return Math.max(listPhotoCount, currentPhotoCount) * ESTIMATED_PHOTO_BYTES;
}

async function prepareImageFile(file) {
  if (!isHeicFile(file)) return file;

  showToast("휴대폰 사진 형식을 변환하는 중입니다.");
  await ensureHeicConverter();
  const converted = await window.heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: IMAGE_QUALITY,
  });

  return Array.isArray(converted) ? converted[0] : converted;
}

async function ensureHeicConverter() {
  if (window.heic2any) return;
  await loadScript("https://cdn.jsdelivr.net/npm/heic2any/dist/heic2any.min.js");
  if (!window.heic2any) {
    throw new Error("HEIC converter unavailable");
  }
}

function resizeImage(file, maxWidth = IMAGE_MAX_WIDTH, maxHeight = IMAGE_MAX_HEIGHT) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0, width, height);
        const blob = await canvasToJpegBlob(canvas, IMAGE_QUALITY);

        URL.revokeObjectURL(url);
        resolve({
          blob,
          dataUrl: await blobToDataUrl(blob),
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image conversion failed"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.readAsDataURL(blob);
  });
}

function isImageFile(file) {
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "");
}

function isHeicFile(file) {
  return /hei(c|f)/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
}

function days() {
  return Array.from({ length: DAY_COUNT }, (_, index) => index + 1);
}

function formatDayDate(day) {
  if (!state.pourDate) return "타설일 미입력";
  return formatMonthDay(addDays(state.pourDate, day - 1));
}

function formatCompactDayDate(day) {
  if (!state.pourDate) return "-";
  const date = addDays(state.pourDate, day - 1);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateValue, offset) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date;
}

function formatMonthDay(date) {
  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatListDate(value) {
  if (!value) return "날짜 없음";
  const date = new Date(`${value}T00:00:00`);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${month}.${day}.(${weekday})`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  return `${Math.round(bytes / 1024 / 1024 / 1024)}GB`;
}

function getStorageDisplayLimitBytes() {
  const configuredMb = Number(config.storageLimitMb);
  if (configuredMb > 0) {
    return configuredMb * 1024 * 1024;
  }

  return STORAGE_DISPLAY_LIMIT_BYTES;
}

function ensureSupabaseClient() {
  if (window.supabase) return Promise.resolve();
  return loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
}

function isKakaoInAppBrowser() {
  return /KAKAOTALK/i.test(navigator.userAgent);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function normalizeProjectName(value) {
  return String(value || DEFAULT_PROJECT_NAME).replaceAll("(주)서화", "(주)한화");
}
