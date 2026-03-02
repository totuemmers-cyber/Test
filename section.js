(function () {
  'use strict';

  function Section(config) {
    var self = this;

    this.name = config.name;
    this.allItems = [];
    this.filteredItems = [];
    this.currentDetailIndex = -1;
    this.filterState = {};
    var init = config.initialFilters || {};
    for (var k in init) {
      if (init.hasOwnProperty(k)) this.filterState[k] = init[k];
    }

    this.grid = config.grid;
    this.searchInput = config.searchInput;
    this.clearSearchBtn = config.clearSearchBtn;
    this.sortSelect = config.sortSelect || null;
    this.noResults = config.noResults;
    this.overlay = config.overlay;
    this.countLabel = config.countLabel;

    this._filterFn = config.filterFn;
    this._sortFn = config.sortFn || null;
    this._createCard = config.createCard;
    this._openDetail = config.openDetail;
    this._onUpdate = config.onUpdate || function () {};
    this._playTick = config.playTick || function () {};
    this._playSwoosh = config.playSwoosh || function () {};
    this._playPop = config.playPop || function () {};

    this.batchSize = config.batchSize || 0;
    this.renderedCount = 0;
    this.isRendering = false;
    this._scrollObserver = null;
    this._searchTimeout = null;

    this._initSearch();
    this._initOverlay(config.closeBtn, config.prevBtn, config.nextBtn);
    if (this.sortSelect) this._initSort();
    if (config.filterGroups) this._initFilterGroups(config.filterGroups);
  }

  // --- Public API ---

  Section.prototype.setItems = function (items) {
    this.allItems = items;
    this.applyFilters();
  };

  Section.prototype.applyFilters = function () {
    var query = this.searchInput.value.trim().toLowerCase();
    var fs = this.filterState;
    var fn = this._filterFn;
    this.filteredItems = this.allItems.filter(function (item) {
      return fn(item, query, fs);
    });
    if (this._sortFn) {
      var sortFn = this._sortFn;
      this.filteredItems.sort(function (a, b) { return sortFn(a, b, fs); });
    }
    this.renderedCount = 0;
    this.grid.innerHTML = '';
    this._render();
    this._onUpdate();
  };

  Section.prototype.openDetail = function (index) {
    if (index < 0 || index >= this.filteredItems.length) return;
    this.currentDetailIndex = index;
    this._openDetail(this.filteredItems[index], index, this);
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this._playPop();
  };

  Section.prototype.closeDetail = function () {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    this.currentDetailIndex = -1;
  };

  Section.prototype.navigateDetail = function (direction) {
    var newIndex = this.currentDetailIndex + direction;
    if (newIndex >= 0 && newIndex < this.filteredItems.length) {
      this.openDetail(newIndex);
    }
  };

  Section.prototype.isOverlayOpen = function () {
    return !this.overlay.classList.contains('hidden');
  };

  Section.prototype.getCount = function () {
    return this.filteredItems.length + ' ' + this.countLabel;
  };

  Section.prototype.openRandom = function () {
    if (this.filteredItems.length === 0) return;
    this.openDetail(Math.floor(Math.random() * this.filteredItems.length));
  };

  // --- Rendering ---

  Section.prototype._render = function () {
    if (this.batchSize > 0) {
      this._renderBatch();
    } else {
      this._renderAll();
    }
  };

  Section.prototype._renderAll = function () {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < this.filteredItems.length; i++) {
      frag.appendChild(this._createCard(this.filteredItems[i], i, this));
    }
    this.grid.appendChild(frag);
    this.noResults.classList.toggle('hidden', this.filteredItems.length > 0);
  };

  Section.prototype._renderBatch = function () {
    if (this.isRendering) return;
    this.isRendering = true;
    var end = Math.min(this.renderedCount + this.batchSize, this.filteredItems.length);
    var frag = document.createDocumentFragment();
    for (var i = this.renderedCount; i < end; i++) {
      frag.appendChild(this._createCard(this.filteredItems[i], i, this));
    }
    this.grid.appendChild(frag);
    this.renderedCount = end;
    this.isRendering = false;
    this.noResults.classList.toggle('hidden', this.filteredItems.length > 0);
    if (this.renderedCount < this.filteredItems.length) {
      this._setupScrollObserver();
    }
  };

  Section.prototype._setupScrollObserver = function () {
    var self = this;
    if (this._scrollObserver) this._scrollObserver.disconnect();
    var sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    this.grid.appendChild(sentinel);
    this._scrollObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        self._scrollObserver.disconnect();
        sentinel.remove();
        self._renderBatch();
      }
    }, { rootMargin: '200px' });
    this._scrollObserver.observe(sentinel);
  };

  // --- Event listener init ---

  Section.prototype._initSearch = function () {
    var self = this;
    this.searchInput.addEventListener('input', function () {
      clearTimeout(self._searchTimeout);
      self.clearSearchBtn.classList.toggle('visible', self.searchInput.value.length > 0);
      self._searchTimeout = setTimeout(function () { self.applyFilters(); }, 200);
    });
    this.clearSearchBtn.addEventListener('click', function () {
      self.searchInput.value = '';
      self.clearSearchBtn.classList.remove('visible');
      self.applyFilters();
      self.searchInput.focus();
    });
  };

  Section.prototype._initSort = function () {
    var self = this;
    this.sortSelect.addEventListener('change', function () {
      self.filterState.sort = this.value;
      self.applyFilters();
    });
  };

  Section.prototype._initFilterGroups = function (groups) {
    var self = this;
    groups.forEach(function (group) {
      group.container.querySelectorAll(group.selector).forEach(function (btn) {
        btn.addEventListener('click', function () {
          group.container.querySelectorAll(group.selector).forEach(function (b) {
            b.classList.remove('active');
          });
          this.classList.add('active');
          self.filterState[group.stateKey] = this.getAttribute(group.dataAttr);
          self._playSwoosh();
          self.applyFilters();
        });
      });
    });
  };

  Section.prototype._initOverlay = function (closeBtn, prevBtn, nextBtn) {
    var self = this;
    closeBtn.addEventListener('click', function () { self.closeDetail(); });
    this.overlay.addEventListener('click', function (e) {
      if (e.target === self.overlay) self.closeDetail();
    });
    prevBtn.addEventListener('click', function () { self.navigateDetail(-1); });
    nextBtn.addEventListener('click', function () { self.navigateDetail(1); });
  };

  window.Section = Section;
})();
