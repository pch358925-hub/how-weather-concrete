const DEFAULT_PROJECT_NAME = "세종천안 2공구 (주)한화";
// 일차 슬롯: 일반 모드는 기존처럼 기본 5개. 관리자 모드에서 전체 2일차 표시나 추가/삭제/이름변경을 조정합니다.
const DEFAULT_DAY_SLOT_COUNT = 5;
const TWO_DAY_SLOT_COUNT = 2;
const MAX_DAY_SLOT_COUNT = 12;
const DAY_SLOT_LIST_STORAGE_KEY = "concrete-photo-board-ui:day-slots";
const DAY_SLOT_EXTRA_HIDDEN_STORAGE_KEY = "concrete-photo-board-ui:day-slot-extra-hidden";
const PRINT_DAY_LABEL_BLIND_STORAGE_KEY = "concrete-photo-board-ui:print-day-label-blind";
const DAY_SLOT_LABELS_STORAGE_KEY = "concrete-photo-board-ui:day-slot-labels";
const PHOTO_TYPES = {
  CURING: "curing",
  TEMPERATURE: "temperature",
};
const PHOTO_MISSING_TEXT = "사진 미등록";
const RAIN_HOLD_TEXT = "우천으로 인한 양생 대기";
const DEFAULT_PHOTO_TYPE = PHOTO_TYPES.CURING;
// 관리자 모드: 검색창에 "관리자" 입력 시 토글. 온도측정 탭·등록정보 표시·파괴적 작업(삭제/타설일 변경)을 관리자 모드로 통합합니다.
const ADMIN_MODE_STORAGE_KEY = "concrete-photo-board-ui:admin";
const ADMIN_TOGGLE_CODE = "관리자";
// 구 버전 "온도 표시/숨김"(표시·숨김) 개인 설정 키 — init에서 정리 후 관리자 모드로 흡수합니다.
const LEGACY_TEMPERATURE_VISIBILITY_STORAGE_KEY = "concrete-photo-board-ui:temperature-visible";
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
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const HEIC2ANY_URL = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
const SCRIPT_LOAD_TIMEOUT_MS = 10000;
const STORAGE_DISPLAY_LIMIT_BYTES = 1024 * 1024 * 1024;
const ESTIMATED_PHOTO_BYTES = 450 * 1024;
const IMAGE_MAX_WIDTH = 1280;
const IMAGE_MAX_HEIGHT = 853;
const IMAGE_QUALITY = 0.7;
const PRINT_PAGE_GROUP_SIZE = 2; // 사진대지 1페이지당 일차 수(2일차 = 사진 2장). 일차 수에 맞춰 페이지가 자동 증감합니다.
const PRINT_MM_SCALE = 6;
const PRINT_PAGE_WIDTH_MM = 210;
const PRINT_PAGE_HEIGHT_MM = 297;
const PRINT_TABLE_WIDTH_MM = 152.02;
const PRINT_TABLE_HEIGHT_MM = 210.1;
const PRINT_TITLE_TOP_MARGIN_MM = 30;
const PRINT_LABEL_WIDTH_MM = 22.03;
const PRINT_MAIN_WIDTH_MM = 113.91;
const PRINT_DAY_WIDTH_MM = 16.08;
const PRINT_PHOTO_ROW_HEIGHT_MM = 84;
const PRINT_INFO_ROW_HEIGHT_MM = 10.525;
const DELETED_BOARD_PROJECT_NAME = "__deleted_photo_board__";
const DELETED_BOARD_LABEL = "[삭제됨]";
const HIDDEN_BOARD_CODES_STORAGE_KEY = "concrete-photo-board-ui:hidden-board-codes";
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
  dayBlindButton: document.getElementById("dayBlindButton"),
  boardSearchBar: document.getElementById("boardSearchBar"),
  boardSearchInput: document.getElementById("boardSearchInput"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  storageMeterText: document.getElementById("storageMeterText"),
  storageMeterBar: document.getElementById("storageMeterBar"),
  boardListSection: document.getElementById("boardListSection"),
  boardListExpandButton: document.getElementById("boardListExpandButton"),
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
let isMetaSaveInProgress = false;
let lastSyncedMeta = { projectName: "", pourPart: "", pourDate: "" };
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
let pasteTargetDay = null;
let printImageCache = {
  signature: "",
  images: [],
};
let isAdminMode = loadAdminMode();
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
  cleanupLegacyPreferences();
  applyAdminModeUi();
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
    setSyncStatus("현재 브라우저에만 저장됩니다. 공유 저장소 연결을 확인해 주세요.");
  }

  renderAll();

  // 현장 통신이 약할 수 있어, PDF 생성용 라이브러리를 미리 받아둔다. (실패해도 무시)
  ensureJsPdf().catch(() => {});
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
  elements.boardSearchInput.addEventListener("keyup", () => {
    if (isBoardSearchComposing) return;
    handleBoardSearchInput();
  });
  elements.boardSearchInput.addEventListener("change", handleBoardSearchInput);
  elements.boardSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearBoardSearch();
      return;
    }
    if (event.key === "Enter" && applyAdminCode(elements.boardSearchInput.value)) {
      event.preventDefault();
    }
  });
  elements.boardSearchInput.addEventListener("paste", () => {
    window.setTimeout(handleBoardSearchInput, 0);
  });
  elements.clearSearchButton.addEventListener("click", clearBoardSearch);
  elements.boardListExpandButton?.addEventListener("click", toggleBoardListExpanded);
  elements.printButton.addEventListener("click", handlePrint);
  elements.newBoardButton.addEventListener("click", createNewBoard);
  elements.dayBlindButton?.addEventListener("click", toggleDaySlotBlindMode);
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
      event.preventDefault();
      event.stopPropagation();
      deleteBoardByShareCode(deleteButton.dataset.deleteBoardCode).catch(console.error);
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
    flushMetaSave({ silent: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (isFilePickerOpen) return;
    if (document.visibilityState === "hidden") {
      flushMetaSave({ silent: true });
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

    const pasteSlot = event.target.closest("[data-paste-day]");
    if (pasteSlot) {
      setPasteTarget(Number(pasteSlot.dataset.pasteDay));
      return;
    }

    const previewButton = event.target.closest("[data-preview-day]");
    if (previewButton) {
      openPhotoViewer(Number(previewButton.dataset.previewDay), previewButton.dataset.previewType);
      return;
    }

    const addSlotButton = event.target.closest("[data-add-slot]");
    if (addSlotButton) {
      addDaySlot();
      return;
    }

    const renameButton = event.target.closest("[data-rename-day]");
    if (renameButton) {
      renameDaySlot(Number(renameButton.dataset.renameDay));
      return;
    }

    const removeButton = event.target.closest("[data-remove-day]");
    if (removeButton) {
      await removeDaySlot(Number(removeButton.dataset.removeDay));
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
  document.addEventListener("paste", handleClipboardPaste);
}

function setPasteTarget(day) {
  if (!day) return;
  pasteTargetDay = day;
  elements.dayGrid.querySelectorAll(".empty-photo.paste-armed").forEach((el) => {
    el.classList.remove("paste-armed");
  });
  const slot = elements.dayGrid.querySelector(`[data-paste-day="${day}"]`);
  if (slot) slot.classList.add("paste-armed");
}

async function handleClipboardPaste(event) {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;

  let file = null;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      file = item.getAsFile();
      break;
    }
  }
  if (!file) return;

  event.preventDefault();

  if (!pasteTargetDay) {
    showToast("먼저 사진을 넣을 일차 칸을 한 번 눌러 선택해 주세요.");
    return;
  }
  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("새 대지를 먼저 만들어 주세요.");
    return;
  }

  const day = pasteTargetDay;
  const photoType = activePhotoType;
  const pastedFile = normalizePastedImageName(file, day, photoType);

  const ok = await handlePhotoUpload(photoType, day, pastedFile);
  if (ok) {
    pasteTargetDay = null;
    await loadBoardList();
    renderAll();
    await flushPendingRealtimeRefresh();
  }
}

function normalizePastedImageName(file, day, photoType) {
  const hasName = file.name && file.name.trim() && file.name !== "image.png";
  if (hasName) return file;
  const ext = (file.type && file.type.split("/")[1]) || "png";
  const safeName = `paste-${normalizePhotoType(photoType)}-day-${day}-${Date.now()}.${ext}`;
  try {
    return new File([file], safeName, { type: file.type || "image/png" });
  } catch {
    return file;
  }
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
    setSyncStatus("실시간 연결에 실패했습니다.\n인터넷 연결을 확인한 뒤 새로고침해 주세요.");
  }
}

function ensureShareCode() {
  const url = new URL(window.location.href);
  const shareCode = url.searchParams.get("board") || "";
  clearBoardUrlParam(url);
  return shareCode;
}

function syncUrlToCurrentBoard() {
  clearBoardUrlParam();
}

function clearBoardUrlParam(sourceUrl = null) {
  const url = sourceUrl || new URL(window.location.href);
  if (!url.searchParams.has("board")) return;
  url.searchParams.delete("board");
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
  lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
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
  lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
  syncInputsFromState();
  saveLocalBoard();
}

async function loadCloudBoard(options = {}) {
  const requestedShareCode = state.shareCode;
  const shouldSyncInputs = options.syncInputs !== false;
  const createIfMissing = options.createIfMissing === true;
  if (loadHiddenBoardCodes().has(requestedShareCode)) {
    resetCurrentBoard({ keepShareCode: true });
    clearMetaDraft();
    return null;
  }

  const { data: board, error } = await dbClient
    .from("photo_boards")
    .select("*, photo_entries(*)")
    .eq("share_code", requestedShareCode)
    .maybeSingle();

  if (error) throw error;
  if (state.shareCode !== requestedShareCode) return null;

  if (board) {
    if (isDeletedBoardRecord(board)) {
      resetCurrentBoard({ keepShareCode: true });
      clearMetaDraft();
      return null;
    }

    state.boardId = board.id;
    state.projectName = normalizeProjectName(board.project_name || DEFAULT_PROJECT_NAME);
    state.pourPart = board.pour_part || "";
    state.pourDate = board.pour_date || toDateInputValue(new Date());
    state.createdAt = board.created_at || "";
    lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
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
    lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
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

function loadHiddenBoardCodes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_BOARD_CODES_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
  } catch {
    return new Set();
  }
}

function saveHiddenBoardCode(shareCode) {
  if (!shareCode) return;
  try {
    const hidden = loadHiddenBoardCodes();
    hidden.add(String(shareCode));
    localStorage.setItem(HIDDEN_BOARD_CODES_STORAGE_KEY, JSON.stringify(Array.from(hidden)));
  } catch {
    // 무시
  }
}

function isDeletedBoardRecord(board) {
  const projectName = board?.project_name ?? board?.projectName ?? "";
  const pourPart = board?.pour_part ?? board?.pourPart ?? "";
  return projectName === DELETED_BOARD_PROJECT_NAME || String(pourPart).startsWith(DELETED_BOARD_LABEL);
}

async function loadCloudBoardList() {
  const hiddenBoardCodes = loadHiddenBoardCodes();
  const { data, error } = await dbClient
    .from("photo_boards")
    .select("id, share_code, project_name, pour_part, pour_date, created_at, updated_at, photo_entries(day_no, photo_url, memo)")
    .not("pour_date", "is", null)
    .order("pour_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  boardList = (data || []).filter((board) => {
    return board.share_code && !hiddenBoardCodes.has(board.share_code) && !isDeletedBoardRecord(board);
  }).map((board) => {
    const pourPart = board.pour_part || "미입력";
    const entries = board.photo_entries || [];
    return {
      boardId: board.id,
      shareCode: board.share_code,
      projectName: normalizeProjectName(board.project_name || DEFAULT_PROJECT_NAME),
      pourPart,
      searchText: normalizeSearchText(pourPart),
      pourDate: board.pour_date || "",
      createdAt: board.created_at || "",
      updatedAt: board.updated_at || "",
      entries,
      completedCount: countCompletedEntries(entries, PHOTO_TYPES.CURING),
      temperatureCount: countCompletedEntries(entries, PHOTO_TYPES.TEMPERATURE),
      photoCount: countPhotoEntries(entries),
    };
  });
}

function loadLocalBoardList() {
  const hiddenBoardCodes = loadHiddenBoardCodes();
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
          entries,
          completedCount: countCompletedEntries(entries, PHOTO_TYPES.CURING),
          temperatureCount: countCompletedEntries(entries, PHOTO_TYPES.TEMPERATURE),
          photoCount: countPhotoEntries(entries),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((board) => Boolean(board.pourDate) && !hiddenBoardCodes.has(board.shareCode) && !isDeletedBoardRecord(board))
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
  metaSaveTimer = window.setTimeout(() => saveMeta({ allowConfirm: false }).catch(console.error), 300);
}

function flushMetaSave(options = {}) {
  pullMetaFromInputs();
  saveMetaDraft();
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  saveMeta({ ...options, allowConfirm: options.silent ? false : options.allowConfirm !== false }).catch(console.error);
}

async function saveMeta(options = {}) {
  const silent = options.silent === true;
  const allowConfirm = options.allowConfirm !== false && !silent;
  if (isMetaSaveInProgress) return;
  isMetaSaveInProgress = true;

  try {
  pullMetaFromInputs();

  if (!state.pourDate) {
    state.pourDate = lastSyncedMeta.pourDate || toDateInputValue(new Date());
    elements.pourDateInput.value = state.pourDate;
    if (!silent) showToast("타설일은 비워둘 수 없어요.");
  }

  if (!state.shareCode) return;
  if (dbClient && !state.boardId) return;

  const hasMetaChange =
    state.projectName !== lastSyncedMeta.projectName ||
    state.pourPart !== lastSyncedMeta.pourPart ||
    state.pourDate !== lastSyncedMeta.pourDate;
  if (!hasMetaChange) return;

  if (countPhotoEntries(state.entries || {}) > 0 && metaChangedFromSynced()) {
    if (!allowConfirm) return;
    const ok = window.confirm(
      `이미 사진이 등록된 대지입니다.\n\n${describeMetaChange()}\n\n이대로 저장할까요?`
    );
    if (!ok) {
      revertMetaInputsToSynced();
      clearMetaDraft();
      renderMetaPreview();
      return;
    }
  }

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
    lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
    await loadBoardList();
    renderBoardList();
    renderStorageMeter();
  } else {
    saveLocalBoard();
    clearMetaDraft();
    lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };
    await loadBoardList();
    renderBoardList();
    renderStorageMeter();
  }
  } finally {
    isMetaSaveInProgress = false;
  }
}

function metaChangedFromSynced() {
  return state.pourPart !== lastSyncedMeta.pourPart || state.pourDate !== lastSyncedMeta.pourDate;
}

function describeMetaChange() {
  const lines = [];
  if (state.pourPart !== lastSyncedMeta.pourPart) {
    lines.push(`타설부위: ${lastSyncedMeta.pourPart || "(미입력)"} → ${state.pourPart || "(미입력)"}`);
  }
  if (state.pourDate !== lastSyncedMeta.pourDate) {
    lines.push(`타설일: ${lastSyncedMeta.pourDate || "(미입력)"} → ${state.pourDate || "(미입력)"}`);
  }
  return lines.join("\n");
}

function revertMetaInputsToSynced() {
  state.pourPart = lastSyncedMeta.pourPart;
  state.pourDate = lastSyncedMeta.pourDate;
  elements.pourPartInput.value = state.pourPart;
  elements.pourDateInput.value = state.pourDate;
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
    const doneText = completed > 0
      ? `${typeConfig.label} 사진 ${completed}장을 등록했습니다.`
      : `${typeConfig.label} 사진을 등록하지 못했습니다.`;
    showToast(`${doneText}${overflowText}${invalidText}${failedText}`);
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

async function deletePhoto(photoType, day, { skipConfirm = false } = {}) {
  const normalizedType = normalizePhotoType(photoType);
  const typeConfig = getPhotoTypeConfig(normalizedType);
  const slotLabel = getPhotoSlotLabel(day, normalizedType);
  const entry = getEntry(day);
  const previousPhoto = getTypedPhoto(entry, normalizedType);
  if (!previousPhoto.photoUrl) return;
  if (!skipConfirm) {
    const ok = window.confirm(`${slotLabel} ${typeConfig.label} 사진을 삭제할까요?`);
    if (!ok) return;
  }

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
  if (!previousRainHold && hasEntryPhoto(entry, PHOTO_TYPES.CURING)) {
    showToast("사진이 등록된 일차는 사진 삭제 후 우천대기로 변경해 주세요.");
    return;
  }

  entry.rainHold = !previousRainHold;
  renderAll();

  const saved = await saveEntry(day, PHOTO_TYPES.CURING);
  if (!saved) {
    entry.rainHold = previousRainHold;
    renderAll();
    showToast(`${day}일차 우천 설정 저장에 실패했습니다.`);
    return;
  }
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
  const normalizedType = normalizePhotoType(photoType);
  // 습윤양생 일차는 관리자가 지정한 사용자 이름을 우선 사용(없으면 "N일차").
  if (normalizedType === PHOTO_TYPES.CURING) {
    const custom = getDaySlotCustomLabel(slot);
    if (custom) return custom;
  }
  const config = getPhotoTypeConfig(normalizedType);
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
  return ` ${count}장은 등록 가능한 일차 칸을 넘어 제외했습니다.`;
}

function setActivePhotoType(photoType) {
  const nextType = normalizePhotoType(photoType);
  // 온도측정 탭은 관리자 모드에서만 선택 가능(일반 모드에서는 흡수되어 접근 불가).
  if (nextType === PHOTO_TYPES.TEMPERATURE && !isAdminMode) {
    return;
  }
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
    button.classList.toggle("temperature-stealth-tab", isTemperatureButton && !isAdminMode);
    button.classList.toggle("temperature-visible-tab", isTemperatureButton && isAdminMode);
  });
}

// ===== 관리자 모드 =====
function loadAdminMode() {
  try {
    return localStorage.getItem(ADMIN_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setAdminMode(on) {
  isAdminMode = Boolean(on);
  try {
    localStorage.setItem(ADMIN_MODE_STORAGE_KEY, isAdminMode ? "1" : "0");
  } catch {
    // 개인 설정 저장 실패는 사진 저장과 별개로 조용히 무시합니다.
  }
  applyAdminModeUi();

  // 관리자 모드를 끄면서 온도측정 탭을 보고 있었다면 습윤양생으로 되돌립니다.
  if (!isAdminMode && activePhotoType === PHOTO_TYPES.TEMPERATURE) {
    setActivePhotoType(PHOTO_TYPES.CURING);
  } else {
    renderPhotoTypeControls();
  }
  renderAll();
}

function applyAdminModeUi() {
  document.body.classList.toggle("admin-mode", isAdminMode);
  // 타설일은 관리자 모드에서만 편집 가능(일반 모드는 잠금).
  if (elements.pourDateInput) elements.pourDateInput.readOnly = !isAdminMode;
  if (elements.prevPourDateButton) elements.prevPourDateButton.disabled = !isAdminMode;
  if (elements.nextPourDateButton) elements.nextPourDateButton.disabled = !isAdminMode;
  renderDaySlotBlindButton();
}

function cleanupLegacyPreferences() {
  // 구 버전 "온도 표시/숨김" 개인 설정을 정리하고 관리자 모드로 흡수합니다.
  try {
    localStorage.removeItem(LEGACY_TEMPERATURE_VISIBILITY_STORAGE_KEY);
  } catch {
    // 무시
  }
}

// ===== 일차 슬롯 구성(관리자 편집) =====
function getStoredDaySlotList() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_SLOT_LIST_STORAGE_KEY) || "null");
    if (Array.isArray(raw)) {
      const cleaned = Array.from(
        new Set(raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1))
      ).sort((a, b) => a - b);
      if (cleaned.length) return cleaned;
    }
  } catch {
    // 무시하고 기본값 사용
  }
  return Array.from({ length: DEFAULT_DAY_SLOT_COUNT }, (_, index) => index + 1);
}

function saveDaySlotList(list) {
  const cleaned = Array.from(
    new Set((list || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1))
  ).sort((a, b) => a - b);
  const finalList = cleaned.length ? cleaned : [1];
  try {
    localStorage.setItem(DAY_SLOT_LIST_STORAGE_KEY, JSON.stringify(finalList));
  } catch {
    // 무시
  }
  return finalList;
}

function loadExtraDaySlotHiddenMode() {
  try {
    return localStorage.getItem(DAY_SLOT_EXTRA_HIDDEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveExtraDaySlotHiddenMode(enabled) {
  try {
    localStorage.setItem(DAY_SLOT_EXTRA_HIDDEN_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // 무시
  }
}

function loadPrintDayLabelBlindMode() {
  try {
    return localStorage.getItem(PRINT_DAY_LABEL_BLIND_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePrintDayLabelBlindMode(enabled) {
  try {
    localStorage.setItem(PRINT_DAY_LABEL_BLIND_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // 무시
  }
}

function renderDaySlotBlindButton() {
  if (!elements.dayBlindButton) return;

  const enabled = loadPrintDayLabelBlindMode();
  elements.dayBlindButton.setAttribute("aria-pressed", String(enabled));
  elements.dayBlindButton.classList.toggle("active", enabled);
  elements.dayBlindButton.title = enabled ? "인쇄 일차 표시" : "인쇄 일차 블라인드";
  elements.dayBlindButton.setAttribute("aria-label", enabled ? "인쇄 일차 표시" : "인쇄 일차 블라인드");
}

function setAllBoardsToTwoDaySlots() {
  if (!isAdminMode) return;

  const ok = window.confirm(
    "모든 타설부위를 1·2일차만 보이도록 변경합니다.\n\n3일차 이후 사진은 삭제하지 않고 블라인드 처리합니다."
  );
  if (!ok) return;

  saveDaySlotList(Array.from({ length: TWO_DAY_SLOT_COUNT }, (_, index) => index + 1));
  saveExtraDaySlotHiddenMode(true);
  pasteTargetDay = null;
  renderAll();
  showToast("모든 타설부위를 2일차 기준으로 표시합니다.");
}

function toggleDaySlotBlindMode() {
  if (!isAdminMode) return;

  const enabled = !loadPrintDayLabelBlindMode();
  savePrintDayLabelBlindMode(enabled);
  printImageCache = { signature: "", images: [] };
  renderAll();
  showToast(enabled ? "인쇄 표의 일차 문구를 가렸습니다." : "인쇄 표의 일차 문구를 표시합니다.");
}

function getEntryItems(entries) {
  if (Array.isArray(entries)) {
    return entries.map((entry, index) => ({
      entry,
      dayNo: getEntryDayNo(entry, index + 1),
    }));
  }

  return Object.entries(entries || {}).map(([key, entry]) => ({
    entry,
    dayNo: getEntryDayNo(entry, key),
  }));
}

function getEntryDayNo(entry, fallback) {
  const dayNo = Number(entry?.dayNo ?? entry?.day_no ?? fallback);
  return Number.isInteger(dayNo) && dayNo >= 1 ? dayNo : 0;
}

function hasDaySlotData(entry) {
  return (
    hasEntryPhoto(entry, PHOTO_TYPES.CURING) ||
    hasEntryPhoto(entry, PHOTO_TYPES.TEMPERATURE) ||
    isRainHoldEntry(entry)
  );
}

// 실제 표시 일차 = 설정된 슬롯 ∪ 이미 사진/데이터가 있는 일차(블라인드가 꺼져 있을 때만 하위 호환 표시).
function getDaySlotList(entries = state.entries) {
  const set = new Set(getStoredDaySlotList());
  if (!loadExtraDaySlotHiddenMode()) {
    getEntryItems(entries).forEach(({ entry, dayNo }) => {
      if (!dayNo || !entry || !hasDaySlotData(entry)) return;
      set.add(dayNo);
    });
  }
  return Array.from(set).sort((a, b) => a - b);
}

function getDaySlotCount(entries = state.entries) {
  return getDaySlotList(entries).length;
}

function addDaySlot() {
  const list = getStoredDaySlotList();
  const displayed = getDaySlotList();
  if (displayed.length >= MAX_DAY_SLOT_COUNT) {
    showToast(`일차는 최대 ${MAX_DAY_SLOT_COUNT}개까지 추가할 수 있습니다.`);
    return;
  }
  const nextDay = (displayed[displayed.length - 1] || 0) + 1;
  list.push(nextDay);
  saveDaySlotList(list);
  renderAll();
  showToast(`${getPhotoSlotLabel(nextDay, PHOTO_TYPES.CURING)}을(를) 추가했습니다.`);
}

async function removeDaySlot(day) {
  const dayNo = Number(day);
  if (!Number.isInteger(dayNo) || dayNo < 1) return;
  if (getDaySlotList().length <= 1) {
    showToast("최소 1개의 일차는 남겨야 합니다.");
    return;
  }

  const entry = state.entries[dayNo];
  const photoCount =
    (entry && hasEntryPhoto(entry, PHOTO_TYPES.CURING) ? 1 : 0) +
    (entry && hasEntryPhoto(entry, PHOTO_TYPES.TEMPERATURE) ? 1 : 0);
  const label = getPhotoSlotLabel(dayNo, PHOTO_TYPES.CURING);

  const confirmed = await confirmDangerousAction({
    title: `${label} 삭제`,
    message:
      photoCount > 0
        ? `${label}에 등록된 사진 ${photoCount}장이 함께 삭제됩니다. 되돌릴 수 없습니다.`
        : `${label} 칸을 삭제합니다.`,
    confirmLabel: "삭제",
    countdownSeconds: photoCount > 0 ? 3 : 0,
  });
  if (!confirmed) return;

  // 사진이 있으면 먼저 저장소에서 삭제
  if (entry) {
    if (hasEntryPhoto(entry, PHOTO_TYPES.CURING)) await deletePhoto(PHOTO_TYPES.CURING, dayNo, { skipConfirm: true });
    if (hasEntryPhoto(entry, PHOTO_TYPES.TEMPERATURE)) await deletePhoto(PHOTO_TYPES.TEMPERATURE, dayNo, { skipConfirm: true });
    delete state.entries[dayNo];
  }

  const remaining = getStoredDaySlotList().filter((value) => value !== dayNo);
  saveDaySlotList(remaining);
  renderAll();
  showToast(`${label}을(를) 삭제했습니다.`);
}

function renameDaySlot(day) {
  const dayNo = Number(day);
  if (!Number.isInteger(dayNo) || dayNo < 1) return;
  const labels = loadDaySlotLabels();
  const current = typeof labels[dayNo] === "string" ? labels[dayNo] : "";
  const input = window.prompt(
    `${dayNo}번째 칸의 이름을 입력하세요. (비우면 "${dayNo}일차"로 표시)`,
    current
  );
  if (input === null) return; // 취소
  const trimmed = input.trim();
  if (trimmed) {
    labels[dayNo] = trimmed;
  } else {
    delete labels[dayNo];
  }
  saveDaySlotLabels(labels);
  renderAll();
  showToast("일차 이름을 변경했습니다.");
}

function loadDaySlotLabels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAY_SLOT_LABELS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDaySlotLabels(map) {
  try {
    localStorage.setItem(DAY_SLOT_LABELS_STORAGE_KEY, JSON.stringify(map || {}));
  } catch {
    // 무시
  }
}

function getDaySlotCustomLabel(day) {
  const value = loadDaySlotLabels()[Number(day)];
  return typeof value === "string" ? value.trim() : "";
}

// ===== 위험 작업 확인 다이얼로그(사진 개수 표시 + 카운트다운) =====
function confirmDangerousAction({ title, message, confirmLabel = "삭제", countdownSeconds = 0 } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h3 class="confirm-title"></h3>
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button type="button" class="small-button confirm-cancel">취소</button>
          <button type="button" class="small-button danger-button confirm-ok"></button>
        </div>
      </div>
    `;
    overlay.querySelector(".confirm-title").textContent = title || "확인";
    overlay.querySelector(".confirm-message").textContent = message || "";
    const okButton = overlay.querySelector(".confirm-ok");
    const cancelButton = overlay.querySelector(".confirm-cancel");

    let remaining = Math.max(0, Math.round(countdownSeconds));
    let timer = 0;

    const updateOkLabel = () => {
      if (remaining > 0) {
        okButton.disabled = true;
        okButton.textContent = `${confirmLabel} (${remaining})`;
      } else {
        okButton.disabled = false;
        okButton.textContent = confirmLabel;
      }
    };

    const cleanup = (result) => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("keydown", onKeydown, true);
      overlay.remove();
      resolve(result);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      }
    };

    okButton.addEventListener("click", () => cleanup(true));
    cancelButton.addEventListener("click", () => cleanup(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cleanup(false);
    });
    document.addEventListener("keydown", onKeydown, true);

    updateOkLabel();
    if (remaining > 0) {
      timer = window.setInterval(() => {
        remaining -= 1;
        updateOkLabel();
        if (remaining <= 0) window.clearInterval(timer);
      }, 1000);
    }

    document.body.appendChild(overlay);
    cancelButton.focus();
  });
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

function countCompletedEntries(entries, photoType = PHOTO_TYPES.CURING, visibleDaySet = null) {
  return getEntryItems(entries).filter(({ entry, dayNo }) => {
    if (visibleDaySet && !visibleDaySet.has(dayNo)) return false;
    return isCompletedEntry(entry, photoType);
  }).length;
}

function countPhotoEntries(entries, visibleDaySet = null) {
  return getEntryItems(entries).reduce((count, { entry, dayNo }) => {
    if (visibleDaySet && !visibleDaySet.has(dayNo)) return count;
    return count + Object.values(PHOTO_TYPES).filter((photoType) => hasEntryPhoto(entry, photoType)).length;
  }, 0);
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
  renderDaySlotBlindButton();
  renderBoardListExpandButton();
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
  renderDaySlotBlindButton();
  renderBoardListExpandButton();
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
  renderBoardListExpandButton();

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
      const boardEntries = board.entries || {};
      const boardDaySlots = getDaySlotList(boardEntries);
      const visibleDaySet = new Set(boardDaySlots);
      const curingCount = countCompletedEntries(boardEntries, PHOTO_TYPES.CURING, visibleDaySet);
      const temperatureCount = countCompletedEntries(boardEntries, PHOTO_TYPES.TEMPERATURE, visibleDaySet);
      const boardDaySlotCount = Math.max(boardDaySlots.length, 1);
      return `
        <div class="board-list-item ${active ? "active" : ""}" data-board-code="${escapeAttribute(board.shareCode)}">
          <span class="board-date">${escapeHtml(formatListDate(board.pourDate))}</span>
          <span class="board-part">${escapeHtml(board.pourPart)}</span>
          <span class="board-counts">
            <span class="board-count ${curingCount >= boardDaySlotCount ? "complete" : ""}">${curingCount}/${boardDaySlotCount} 양생</span>
            ${
              temperatureCount > 0
                ? `<span class="board-count temperature">${temperatureCount}장 측정</span>`
                : ""
            }
            ${
              isAdminMode
                ? `<button class="board-list-delete-button admin-only" type="button" data-delete-board-code="${escapeAttribute(board.shareCode)}" title="사진대지 삭제" aria-label="${escapeAttribute(board.pourPart)} 사진대지 삭제">×</button>`
                : ""
            }
          </span>
        </div>
      `;
    })
    .join("");
}

function toggleBoardListExpanded() {
  if (!elements.boardListSection) return;

  const expanded = !elements.boardListSection.classList.contains("board-list-expanded");
  elements.boardListSection.classList.toggle("board-list-expanded", expanded);
  renderBoardListExpandButton();
}

function renderBoardListExpandButton() {
  if (!elements.boardListExpandButton || !elements.boardListSection) return;

  const expanded = elements.boardListSection.classList.contains("board-list-expanded");
  elements.boardListExpandButton.setAttribute("aria-expanded", String(expanded));
  elements.boardListExpandButton.setAttribute("aria-label", expanded ? "사진대지 목록 접기" : "사진대지 목록 펼치기");
  elements.boardListExpandButton.title = expanded ? "사진대지 목록 접기" : "사진대지 목록 펼치기";

  const icon = elements.boardListExpandButton.querySelector(".button-icon");
  if (icon) icon.textContent = expanded ? "▴" : "▾";
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
  if (applyAdminCode(value)) return;

  boardSearchQuery = value;
  scheduleBoardListRender();
}

function applyAdminCode(value) {
  // 검색창에 "관리자" 입력 시 관리자 모드 온/오프 토글.
  if (!isAdminCode(value)) return false;

  setAdminMode(!isAdminMode);
  boardSearchQuery = "";
  elements.boardSearchInput.value = "";
  renderBoardList();
  showToast(isAdminMode ? "관리자 모드를 켰습니다." : "관리자 모드를 껐습니다.");
  return true;
}

function isAdminCode(value) {
  const normalized = normalizeSearchText(value).replace(/["'`“”‘’]/g, "");
  return normalized === ADMIN_TOGGLE_CODE || normalized.includes(ADMIN_TOGGLE_CODE);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
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
  const canEditSlots = isAdminMode && photoType === PHOTO_TYPES.CURING;
  let gridHtml = days()
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
                ? `<button class="rain-toggle ${rainHold ? "active" : ""}" type="button" data-rain-day="${day}" aria-pressed="${rainHold}" title="${escapeAttribute(slotLabel)} 우천 대기 표시" aria-label="${escapeAttribute(slotLabel)} 우천 대기 표시">
                    <span aria-hidden="true">☔</span>
                  </button>`
                : ""
            }
            ${
              canEditSlots
                ? `<span class="slot-admin-controls admin-only">
                    <button class="icon-mini" type="button" data-rename-day="${day}" title="일차 이름 변경" aria-label="${escapeAttribute(slotLabel)} 이름 변경"><span aria-hidden="true">✎</span></button>
                    <button class="icon-mini danger" type="button" data-remove-day="${day}" title="이 일차 삭제" aria-label="${escapeAttribute(slotLabel)} 삭제"><span aria-hidden="true">🗑</span></button>
                  </span>`
                : ""
            }
            <span class="date-pill">${escapeHtml(slotDateLabel)}</span>
          </div>
          <div class="photo-preview" data-photo-slot="${day}">
            ${
              hasPhoto
                ? `<button class="photo-preview-button" type="button" data-preview-day="${day}" data-preview-type="${escapeAttribute(photoType)}" title="${escapeAttribute(slotLabel)} 사진 크게 보기">
                    <img src="${escapeAttribute(photo.photoUrl)}" alt="${escapeAttribute(slotLabel)} ${escapeAttribute(typeConfig.label)} 사진" loading="lazy" decoding="async">
                  </button>`
                : `<button class="empty-photo ${rainHold ? "rain-hold" : ""}" type="button" data-paste-day="${day}" title="여기를 누른 뒤 Ctrl+V로 붙여넣기"><span>${escapeHtml(emptyPhotoText)}</span></button>`
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
            ${hasPhoto && isAdminMode ? `<div class="uploaded-meta admin-only">${renderUploadedMeta(photo)}</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  if (canEditSlots && getDaySlotList().length < MAX_DAY_SLOT_COUNT) {
    gridHtml += `
      <article class="day-card add-slot-card admin-only">
        <button type="button" class="add-slot-button" data-add-slot title="일차 추가">
          <span class="add-slot-plus" aria-hidden="true">＋</span>
          <span>일차 추가</span>
        </button>
      </article>
    `;
  }

  elements.dayGrid.innerHTML = gridHtml;

  if (pasteTargetDay) {
    const armed = elements.dayGrid.querySelector(`[data-paste-day="${pasteTargetDay}"]`);
    if (armed) armed.classList.add("paste-armed");
    else pasteTargetDay = null;
  }
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
      const { images } = await getPrintPageImages();
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
    printDayLabelBlind: loadPrintDayLabelBlindMode(),
  });
}

function getPrintSlots(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  if (normalizedType === PHOTO_TYPES.CURING) return days();

  return days().filter((day) => hasEntryPhoto(getEntry(day), normalizedType));
}

function getPrintPageGroups(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  // 일차 수에 맞춰 페이지 그룹을 동적으로 구성(페이지당 PRINT_PAGE_GROUP_SIZE일차).
  const slots = getPrintSlots(normalizedType);
  const groups = [];
  for (let index = 0; index < slots.length; index += PRINT_PAGE_GROUP_SIZE) {
    const group = slots.slice(index, index + PRINT_PAGE_GROUP_SIZE);
    while (group.length < PRINT_PAGE_GROUP_SIZE) group.push(null);
    groups.push(group);
  }
  return groups;
}

async function getPrintPageImages() {
  const signature = getPrintImageSignature();
  if (printImageCache.signature === signature && Array.isArray(printImageCache.images)) {
    return { images: printImageCache.images, failedCount: printImageCache.failedCount || 0 };
  }

  const photoType = activePhotoType;
  const groups = getPrintPageGroups(photoType);
  const photos = await loadPrintPhotos(photoType);
  const failedCount = countPrintPhotoFailures(photos);
  const images = groups.map((group) => createPrintPageImage(group, photos, photoType));
  printImageCache = { signature, images, failedCount };
  return { images, failedCount };
}

async function loadPrintPhotos(photoType = activePhotoType) {
  const normalizedType = normalizePhotoType(photoType);
  const slots = getPrintSlots(normalizedType);
  const photoPairs = await Promise.all(
    slots.map(async (day) => {
      const photoUrl = getTypedPhoto(getEntry(day), normalizedType).photoUrl;
      if (!photoUrl) return [day, { image: null, failed: false }];
      const image = await loadPrintPhoto(photoUrl);
      return [day, { image, failed: !image }];
    })
  );

  return Object.fromEntries(photoPairs);
}

function countPrintPhotoFailures(photos) {
  return Object.values(photos || {}).filter((info) => info && info.failed).length;
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
  const titleY = printMm(PRINT_TITLE_TOP_MARGIN_MM);
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
  const tableY = printMm(PRINT_TITLE_TOP_MARGIN_MM + titleHeightMm + 16.9);
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
  const tableY = printMm(PRINT_TITLE_TOP_MARGIN_MM + titleHeightMm + 16.9);
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

  const photoInfo = photos[day] || { image: null, failed: false };
  drawPrintPhoto(ctx, day, x, y, tableW, photoH, photoInfo, allowPhotos, photoType);
  drawCenteredPrintText(ctx, "위  치", x, infoY, labelW, infoH, 13, "Batang, serif");
  drawPrintMainTextCanvas(ctx, state.pourPart || "", x + labelW, infoY, mainW, infoH, {
    breakAfterFirstBracket: true,
  });
  if (!loadPrintDayLabelBlindMode()) {
    drawCenteredPrintText(ctx, getPhotoSlotLabel(day, photoType), x + labelW + mainW, infoY, dayW, infoH, 13, "Batang, serif");
  }
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

function drawPrintPhoto(ctx, day, x, y, width, height, photoInfo, allowPhotos, photoType = activePhotoType) {
  const info = photoInfo || { image: null, failed: false };
  const photoW = printMm(PRINT_PHOTO_WIDTH_MM);
  const photoH = printMm(PRINT_PHOTO_HEIGHT_MM);
  const photoX = x + (width - photoW) / 2;
  const photoY = y + (height - photoH) / 2;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(photoX, photoY, photoW, photoH);

  if (allowPhotos && info.image) {
    drawCoverImage(ctx, info.image, photoX, photoY, photoW, photoH);
  } else if (info.failed) {
    drawCenteredPrintText(ctx, "사진 불러오기 실패", photoX, photoY, photoW, photoH, 13, "Batang, serif");
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
  if (ctx.measureText(text).width <= maxWidth) return [text];

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
  const majorCommaBreakIndex = findTopLevelPrintBreakIndex(chars, [",", "，", "、"], (source, index) => {
    return source.slice(index + 1).join("").trimStart().toUpperCase().startsWith("STA.");
  });
  if (majorCommaBreakIndex >= 0) {
    return [
      chars.slice(0, majorCommaBreakIndex + 1).join("").trim(),
      chars.slice(majorCommaBreakIndex + 1).join("").trim(),
    ].filter(Boolean);
  }

  const closeBracketIndex = chars.findIndex((char, index) => {
    return [")", "]", "}"].includes(char) && index < chars.length - 1;
  });

  if (closeBracketIndex >= 0) {
    return [
      chars.slice(0, closeBracketIndex + 1).join("").trim(),
      chars.slice(closeBracketIndex + 1).join("").trim(),
    ].filter(Boolean);
  }

  const commaBreakIndex = findTopLevelPrintBreakIndex(chars, [",", "，", "、"]);
  if (commaBreakIndex >= 0) {
    return [
      chars.slice(0, commaBreakIndex + 1).join("").trim(),
      chars.slice(commaBreakIndex + 1).join("").trim(),
    ].filter(Boolean);
  }

  return [text];
}

function findTopLevelPrintBreakIndex(chars, delimiters, predicate = null) {
  let depth = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (["(", "[", "{"].includes(char)) {
      depth += 1;
      continue;
    }
    if ([")", "]", "}"].includes(char)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (
      depth === 0 &&
      delimiters.includes(char) &&
      index < chars.length - 1 &&
      (!predicate || predicate(chars, index))
    ) {
      return index;
    }
  }
  return -1;
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
  if (!state.shareCode || (dbClient && !state.boardId)) {
    showToast("먼저 사진대지를 선택하거나 만들어 주세요.");
    return;
  }

  elements.printButton.disabled = true;
  showToast("출력 파일을 준비하는 중입니다.");
  try {
    const { images, failedCount } = await getPrintPageImages();
    if (!images.length) {
      showToast(`${getPhotoTypeConfig(activePhotoType).sectionTitle}이 없습니다.`);
      return;
    }

    if (failedCount > 0) {
      showToast(`사진 ${failedCount}장을 불러오지 못해 '사진 불러오기 실패'로 표시됩니다. 잠시 후 다시 시도해 보세요.`);
    }

    const saved = await savePrintPdf(images);
    if (saved) {
      const savedText = isKakaoInAppBrowser() ? "PDF 다운로드를 시작합니다." : "PDF를 저장했습니다.";
      showToast(failedCount > 0 ? `${savedText} (일부 사진 로드 실패)` : savedText);
      return;
    }

    // PDF 생성 실패 시(라이브러리 미로딩 등) 기존 인쇄 창 방식으로 폴백
    openPrintWindowFallback(images);
  } catch (error) {
    console.error(error);
    showToast("출력 파일을 만들지 못했습니다.");
  } finally {
    elements.printButton.disabled = false;
  }
}

async function savePrintPdf(images) {
  let jsPdfCtor = null;
  try {
    jsPdfCtor = await ensureJsPdf();
  } catch (error) {
    console.error("jsPDF 로드 실패", error);
    return false;
  }
  if (!jsPdfCtor) return false;

  try {
    const pdf = new jsPdfCtor({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    images.forEach((src, index) => {
      if (index > 0) pdf.addPage();
      pdf.addImage(src, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    });

    const filename = buildPdfFilename();

    if (isKakaoInAppBrowser()) {
      const blob = pdf.output("blob");
      return await deliverPdfViaStorage(blob, filename);
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error("PDF 생성 실패", error);
    return false;
  }
}

async function deliverPdfViaStorage(blob, filename) {
  if (!dbClient || !state.shareCode) return false;

  const path = `${state.shareCode}/pdf/${normalizePhotoType(activePhotoType)}.pdf`;
  const { error: uploadError } = await dbClient.storage
    .from(config.bucket)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("PDF 업로드 실패", uploadError);
    return false;
  }

  const { data } = dbClient.storage.from(config.bucket).getPublicUrl(path, { download: filename });
  if (!data?.publicUrl) return false;

  window.location.href = data.publicUrl;
  return true;
}

function buildPdfFilename() {
  const part = (state.pourPart || "사진대지").replace(/[\\/:*?"<>|]/g, "_").trim() || "사진대지";
  const typeLabel = getPhotoTypeConfig(activePhotoType).label || "";
  const date = state.pourDate ? `_${state.pourDate}` : "";
  return `${part}_${typeLabel}${date}.pdf`;
}

function openPrintWindowFallback(images) {
  if (isKakaoInAppBrowser()) {
    showToast("카톡 안에서는 PDF 저장이 막힐 수 있습니다. 오른쪽 위 ··· → 다른 브라우저로 열어 주세요.");
    return;
  }
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("PDF 저장에 실패했고 새 창도 차단됐습니다. 팝업을 허용한 뒤 다시 눌러 주세요.");
    return;
  }
  writeRasterPrintDocument(printWindow, images);
  showToast("PDF 저장 대신 인쇄 창을 열었습니다. '대상: PDF로 저장'을 선택하세요.");
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

  endFilePickNow();
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  boardLoadToken += 1;
  activePhotoType = DEFAULT_PHOTO_TYPE;

  const shareCode = createShareCode();
  clearBoardUrlParam();

  state = {
    shareCode,
    boardId: null,
    projectName: DEFAULT_PROJECT_NAME,
    pourPart: "",
    pourDate: toDateInputValue(new Date()),
    entries: {},
  };
  lastSyncedMeta = { projectName: state.projectName, pourPart: state.pourPart, pourDate: state.pourDate };

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

async function deleteCurrentBoard() {
  await deleteBoardByShareCode(state.shareCode);
}

async function deleteBoardByShareCode(shareCode) {
  if (!isAdminMode) {
    showToast("관리자 모드에서만 사진대지를 삭제할 수 있습니다.");
    return;
  }
  if (!shareCode) {
    showToast("삭제할 사진대지가 없습니다.");
    return;
  }
  if (activePhotoMutationCount > 0) {
    showToast("사진 등록이 끝난 뒤 사진대지를 삭제해 주세요.");
    return;
  }

  let target = null;
  try {
    target = await loadBoardDeleteTarget(shareCode);
  } catch (error) {
    console.error(error);
    showToast("삭제할 사진대지를 확인하지 못했습니다.");
    return;
  }
  if (!target) {
    showToast("삭제할 사진대지를 찾지 못했습니다.");
    await loadBoardList();
    renderBoardList();
    return;
  }

  const photoCount = countPhotoEntries(target.entries || {});
  const pourPart = target.pourPart || "미입력";
  const confirmed = await confirmDangerousAction({
    title: "사진대지 삭제",
    message:
      photoCount > 0
        ? `${pourPart} 사진대지와 등록된 사진 ${photoCount}장이 함께 삭제됩니다. 되돌릴 수 없습니다.`
        : `${pourPart} 사진대지를 삭제합니다.`,
    confirmLabel: "삭제",
    countdownSeconds: photoCount > 0 ? 3 : 0,
  });
  if (!confirmed) return;

  endFilePickNow();
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;

  const deletedShareCode = shareCode;
  const deletingCurrent = state.shareCode === deletedShareCode;
  const nextShareCode = boardList.find((board) => board.shareCode !== deletedShareCode)?.shareCode || "";

  try {
    if (target.boardId && dbClient) {
      if (deletingCurrent && realtimeChannel) {
        await dbClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      await deleteCloudBoardTarget(target);
    } else {
      localStorage.removeItem(LOCAL_PREFIX + deletedShareCode);
    }
    localStorage.removeItem(META_DRAFT_PREFIX + deletedShareCode);
  } catch (error) {
    console.error(error);
    showToast("사진대지 삭제에 실패했습니다.");
    return;
  }

  saveHiddenBoardCode(deletedShareCode);
  await loadBoardList();

  if (deletingCurrent) {
    state.shareCode = "";
    state.boardId = null;

    if (nextShareCode && boardList.some((board) => board.shareCode === nextShareCode)) {
      await openBoard(nextShareCode);
    } else {
      resetCurrentBoard();
      syncUrlToCurrentBoard();
      await loadBoardList();
      renderAll();
    }
  } else {
    renderAll();
  }

  showToast("사진대지를 삭제했습니다.");
}

async function loadBoardDeleteTarget(shareCode) {
  if (!shareCode) return null;

  if (!dbClient) {
    if (shareCode === state.shareCode) {
      return {
        shareCode,
        boardId: null,
        pourPart: state.pourPart || "",
        entries: normalizeEntries(state.entries || {}),
      };
    }

    const saved = localStorage.getItem(LOCAL_PREFIX + shareCode);
    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      return {
        shareCode,
        boardId: null,
        pourPart: parsed.pourPart || "",
        entries: normalizeEntries(parsed.entries || {}),
      };
    } catch (error) {
      console.warn("Local board delete target parse failed", error);
      return null;
    }
  }

  if (shareCode === state.shareCode && state.boardId) {
    return {
      shareCode,
      boardId: state.boardId,
      pourPart: state.pourPart || "",
      entries: normalizeEntries(state.entries || {}),
    };
  }

  const listBoard = boardList.find((board) => board.shareCode === shareCode);
  const { data, error } = await dbClient
    .from("photo_boards")
    .select("id, share_code, project_name, pour_part")
    .eq("share_code", shareCode)
    .maybeSingle();
  if (error) throw error;
  const board = data || (listBoard?.boardId ? {
    id: listBoard.boardId,
    share_code: listBoard.shareCode,
    project_name: listBoard.projectName,
    pour_part: listBoard.pourPart,
  } : null);
  if (!board || isDeletedBoardRecord(board)) return null;

  const entries = {};
  const { data: entryRows, error: entryError } = await dbClient
    .from("photo_entries")
    .select("*")
    .eq("board_id", board.id);
  if (entryError) {
    console.warn("Board delete entry lookup failed", entryError);
  }

  (entryRows || []).forEach((row) => {
    const memo = parseEntryMemo(row.memo);
    entries[row.day_no] = {
      dayNo: row.day_no,
      photoUrl: row.photo_url || "",
      photoPath: row.photo_path || "",
      uploadedAt: row.uploaded_at || "",
      rainHold: memo.rainHold,
      photos: memo.photos || {},
    };
  });

  return {
    shareCode,
    boardId: board.id,
    pourPart: board.pour_part || "",
    entries: normalizeEntries(entries),
  };
}

async function deleteCloudBoardTarget(target) {
  if (!dbClient || !target?.boardId) return false;

  const photoPaths = collectBoardPhotoPaths(target.entries || {});
  let hardDeleteError = null;

  try {
    const { error: entryError } = await dbClient
      .from("photo_entries")
      .delete()
      .eq("board_id", target.boardId);

    if (!entryError) {
      const { error: boardError } = await dbClient
        .from("photo_boards")
        .delete()
        .eq("id", target.boardId);
      hardDeleteError = boardError;
    } else {
      hardDeleteError = entryError;
    }
  } catch (error) {
    hardDeleteError = error;
  }

  const remainingAfterHardDelete = await fetchCloudBoardDeleteRecord(target.boardId);
  if (!remainingAfterHardDelete) {
    await removeBoardStoragePaths(photoPaths);
    return true;
  }
  if (hardDeleteError) {
    console.warn("Hard board delete failed; using soft delete marker", hardDeleteError);
  } else {
    console.warn("Hard board delete did not remove the board; using soft delete marker");
  }

  await markCloudBoardAsDeleted(target);
  return true;
}

async function fetchCloudBoardDeleteRecord(boardId) {
  const { data, error } = await dbClient
    .from("photo_boards")
    .select("id, share_code, project_name, pour_part, pour_date")
    .eq("id", boardId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function markCloudBoardAsDeleted(target) {
  const now = new Date().toISOString();
  const deletedPourPart = `[deleted] ${target.pourPart || ""}`.trim();
  const { data, error } = await dbClient
    .from("photo_boards")
    .update({
      project_name: DELETED_BOARD_PROJECT_NAME,
      pour_part: deletedPourPart,
      updated_at: now,
    })
    .eq("id", target.boardId)
    .select("id, share_code, project_name, pour_part, pour_date")
    .maybeSingle();
  if (error) throw error;
  if (data && isDeletedBoardRecord(data)) return true;

  const verified = await fetchCloudBoardDeleteRecord(target.boardId);
  if (!verified || isDeletedBoardRecord(verified)) return true;

  throw new Error("Board delete marker was not applied.");
}

function collectBoardPhotoPaths(entries) {
  const paths = new Set();
  getEntryItems(entries).forEach(({ entry }) => {
    Object.values(PHOTO_TYPES).forEach((photoType) => {
      const photo = getTypedPhoto(entry, photoType);
      if (photo.photoPath) paths.add(photo.photoPath);
    });
  });
  return Array.from(paths);
}

async function removeBoardStoragePaths(paths) {
  if (!dbClient || !paths.length) return;
  const { error } = await dbClient.storage.from(config.bucket).remove(paths);
  if (error) {
    console.warn("Board photo storage cleanup failed", error);
  }
}

async function openBoard(shareCode) {
  if (!shareCode) return;
  if (activePhotoMutationCount > 0) {
    showToast("사진 등록이 끝난 뒤 다른 타설부위를 열어 주세요.");
    return;
  }

  endFilePickNow();
  window.clearTimeout(metaSaveTimer);
  metaSaveTimer = null;
  activePhotoType = DEFAULT_PHOTO_TYPE;
  if (state.shareCode && shareCode !== state.shareCode) {
    await saveMeta();
  }

  const token = ++boardLoadToken;
  const selectedBoard = boardList.find((board) => board.shareCode === shareCode);
  clearBoardUrlParam();
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
  await loadScript(HEIC2ANY_URL);
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
  return getDaySlotList();
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
  return loadScript(SUPABASE_JS_URL);
}

async function ensureJsPdf() {
  const getCtor = () => {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    return null;
  };
  if (getCtor()) return getCtor();
  await loadScript(JSPDF_URL);
  return getCtor();
}

function isKakaoInAppBrowser() {
  return /KAKAOTALK/i.test(navigator.userAgent);
}

function loadScript(src, timeoutMs = SCRIPT_LOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    let timeoutId = 0;
    let targetScript = existing;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (!targetScript) return;
      targetScript.removeEventListener("load", onLoad);
      targetScript.removeEventListener("error", onError);
    };

    const onLoad = () => {
      if (targetScript) targetScript.dataset.loaded = "true";
      cleanup();
      resolve();
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      if (targetScript && targetScript.dataset.loaded !== "true") {
        targetScript.remove();
      }
      reject(new Error(`Script load timeout: ${src}`));
    };

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      timeoutId = window.setTimeout(onTimeout, timeoutMs);
      return;
    }

    const script = document.createElement("script");
    targetScript = script;
    script.src = src;
    script.async = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(onTimeout, timeoutMs);
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
  const text = String(value == null ? "" : value).trim();
  return text || DEFAULT_PROJECT_NAME;
}
