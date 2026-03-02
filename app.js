(function () {
  'use strict';

  // === STATE ===
  var activeTab = 'hiragana';
  var countersRendered = false;
  var soundEnabled = localStorage.getItem('kanji-sound') !== 'off';

  // Shared constants
  var LEVEL_ORDER = { 'N5': 0, 'N4': 1, 'N3': 2, 'N2': 3, 'N1': 4 };

  // === SOUND ENGINE ===
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTick() {
    if (!soundEnabled) return;
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  }

  function playPop() {
    if (!soundEnabled) return;
    try {
      var ctx = getAudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  function playSwoosh() {
    if (!soundEnabled) return;
    try {
      var ctx = getAudioCtx();
      var bufferSize = ctx.sampleRate * 0.08;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      var noise = ctx.createBufferSource();
      noise.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(6000, ctx.currentTime + 0.06);
      filter.Q.value = 0.5;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
    } catch (e) {}
  }

  // === SHARED DOM ===
  var itemCountEl = document.getElementById('item-count');
  var themeToggle = document.getElementById('theme-toggle');
  var randomBtn = document.getElementById('random-btn');
  var soundToggle = document.getElementById('sound-toggle');

  var kanjiControls = document.getElementById('kanji-controls');
  var grammarControls = document.getElementById('grammar-controls');
  var vocabControls = document.getElementById('vocab-controls');
  var countersControls = document.getElementById('counters-controls');
  var radicalsControls = document.getElementById('radicals-controls');

  var kanjiTab = document.getElementById('kanji-tab');
  var grammarTab = document.getElementById('grammar-tab');
  var vocabTab = document.getElementById('vocab-tab');
  var countersTab = document.getElementById('counters-tab');
  var radicalsTab = document.getElementById('radicals-tab');
  var hiraganaTab = document.getElementById('hiragana-tab');
  var katakanaTab = document.getElementById('katakana-tab');

  var loadingEl = document.getElementById('loading');

  // === SECTIONS REGISTRY ===
  var sections = {};
  var sectionNames = ['kanji', 'grammar', 'vocab', 'counters', 'radicals'];

  // === LAZY DATA LOADING ===
  var dataLoaded = { kanji: false, grammar: false, vocab: false, counters: false, radicals: false };
  var dataLoading = { kanji: false, grammar: false, vocab: false, counters: false, radicals: false };
  var dataCallbacks = { kanji: [], grammar: [], vocab: [], counters: [], radicals: [] };

  var sectionLoadingEls = {
    kanji: loadingEl,
    grammar: document.getElementById('grammar-loading'),
    vocab: document.getElementById('vocab-loading'),
    counters: document.getElementById('counters-loading'),
    radicals: document.getElementById('radicals-loading')
  };

  function showSectionLoading(name) {
    var el = sectionLoadingEls[name];
    if (el) el.classList.remove('hidden');
  }

  function hideSectionLoading(name) {
    var el = sectionLoadingEls[name];
    if (el) el.classList.add('hidden');
  }

  function loadScript(src, callback) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    script.onerror = function () {
      console.error('Failed to load: ' + src);
      if (callback) callback();
    };
    document.head.appendChild(script);
  }

  function loadScriptsSequential(srcs, done) {
    var i = 0;
    function next() {
      if (i >= srcs.length) { done(); return; }
      loadScript(srcs[i++], next);
    }
    next();
  }

  function ensureSectionData(sectionName, callback) {
    if (dataLoaded[sectionName]) { callback(); return; }
    dataCallbacks[sectionName].push(callback);
    if (dataLoading[sectionName]) return;
    dataLoading[sectionName] = true;
    showSectionLoading(sectionName);

    var loaders = {
      kanji: function (done) {
        loadScriptsSequential(['kanji-data.js', 'kanji-n1.js'], function () {
          var kanji = window.KANJI_DATA || [];
          if (window.KANJI_N1_DATA) kanji = kanji.concat(window.KANJI_N1_DATA);
          sections.kanji.setItems(kanji);
          done();
        });
      },
      grammar: function (done) {
        loadScriptsSequential(['grammar-data.js', 'grammar-n2.js', 'grammar-n1.js'], function () {
          if (window.GRAMMAR_DATA) sections.grammar.setItems(window.GRAMMAR_DATA);
          done();
        });
      },
      vocab: function (done) {
        var loaded = 0;
        var total = 5;
        var vocabFiles = ['vocab-n5.js', 'vocab-n4.js', 'vocab-n3.js', 'vocab-n2.js', 'vocab-n1.js'];
        vocabFiles.forEach(function (src) {
          loadScript(src, function () {
            loaded++;
            if (loaded === total) {
              var vocabData = [].concat(
                window.VOCAB_N5 || [], window.VOCAB_N4 || [],
                window.VOCAB_N3 || [], window.VOCAB_N2 || [],
                window.VOCAB_N1 || []
              );
              if (vocabData.length > 0) sections.vocab.setItems(vocabData);
              done();
            }
          });
        });
      },
      counters: function (done) {
        loadScript('counters-data.js', function () {
          if (window.COUNTERS_DATA && window.COUNTERS_DATA.counters) {
            sections.counters.setItems(window.COUNTERS_DATA.counters);
          }
          done();
        });
      },
      radicals: function (done) {
        loadScript('kangxi-radicals-data.js', function () {
          if (window.KANGXI_RADICALS) sections.radicals.setItems(window.KANGXI_RADICALS);
          done();
        });
      }
    };

    loaders[sectionName](function () {
      dataLoaded[sectionName] = true;
      dataLoading[sectionName] = false;
      hideSectionLoading(sectionName);
      var cbs = dataCallbacks[sectionName];
      dataCallbacks[sectionName] = [];
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    });
  }

  // === SHARED HELPERS ===
  function updateCount() {
    if (activeTab === 'hiragana') {
      itemCountEl.textContent = 'Hiragana';
    } else if (activeTab === 'katakana') {
      itemCountEl.textContent = 'Katakana';
    } else if (sections[activeTab]) {
      if (!dataLoaded[activeTab]) {
        itemCountEl.textContent = 'Laden...';
      } else {
        itemCountEl.textContent = sections[activeTab].getCount();
      }
    }
  }

  function renderExamples(container, examples) {
    if (examples && examples.length > 0) {
      container.innerHTML = examples.map(function (ex) {
        return '<div class="grammar-example-item">' +
          '<div class="grammar-example-jp">' + ex.japanese + '</div>' +
          '<div class="grammar-example-romaji">' + ex.romaji + '</div>' +
          '<div class="grammar-example-german">' + ex.german + '</div>' +
        '</div>';
      }).join('');
    } else {
      container.innerHTML = '<div class="no-reading">Keine Beispiele</div>';
    }
  }

  // Common config shared by all sections
  var sectionSounds = { playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount };

  // ==========================================
  // === KANJI SECTION ===
  // ==========================================

  var detailKanji = document.getElementById('detail-kanji');
  var detailJlpt = document.getElementById('detail-jlpt');
  var detailMeanings = document.getElementById('detail-meanings');
  var detailStrokes = document.getElementById('detail-strokes');
  var detailKun = document.getElementById('detail-kun');
  var detailOn = document.getElementById('detail-on');
  var detailComponents = document.getElementById('detail-components');
  var detailExamples = document.getElementById('detail-examples');
  var radicalFilter = document.getElementById('radical-filter');
  var radicalFilterName = document.getElementById('radical-filter-name');

  sections.kanji = new Section({
    name: 'kanji',
    grid: document.getElementById('kanji-grid'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    sortSelect: document.getElementById('sort-select'),
    noResults: document.getElementById('no-results'),
    overlay: document.getElementById('detail-overlay'),
    closeBtn: document.getElementById('close-detail'),
    prevBtn: document.getElementById('prev-kanji'),
    nextBtn: document.getElementById('next-kanji'),
    countLabel: 'Kanji',
    batchSize: 80,
    initialFilters: { level: 'all', radical: null, sort: 'jlpt' },
    filterGroups: [{
      container: kanjiControls,
      selector: '.filter-btn',
      dataAttr: 'data-level',
      stateKey: 'level'
    }],
    playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount,

    filterFn: function (k, query, fs) {
      if (fs.level !== 'all' && k.jlpt !== fs.level) return false;
      if (fs.radical) {
        var hasRad = k.components && k.components.some(function (c) { return c.radical === fs.radical; });
        if (!hasRad) return false;
      }
      if (query) {
        var mK = k.kanji === query;
        var mM = k.meanings.some(function (m) { return m.toLowerCase().indexOf(query) !== -1; });
        var mKun = k.kun && k.kun.some(function (r) { return r.kana.indexOf(query) !== -1 || r.romaji.toLowerCase().indexOf(query) !== -1; });
        var mOn = k.on && k.on.some(function (r) { return r.kana.indexOf(query) !== -1 || r.romaji.toLowerCase().indexOf(query) !== -1; });
        var mEx = k.examples && k.examples.some(function (ex) { return ex.word.indexOf(query) !== -1 || ex.reading.indexOf(query) !== -1 || ex.meaning.toLowerCase().indexOf(query) !== -1; });
        if (!mK && !mM && !mKun && !mOn && !mEx) return false;
      }
      return true;
    },

    sortFn: function (a, b, fs) {
      if (fs.sort === 'jlpt') {
        var la = LEVEL_ORDER[a.jlpt] || 9, lb = LEVEL_ORDER[b.jlpt] || 9;
        if (la !== lb) return la - lb;
        return a.strokes - b.strokes;
      }
      if (fs.sort === 'strokes') return a.strokes - b.strokes;
      if (fs.sort === 'alpha') return a.meanings[0].toLowerCase().localeCompare(b.meanings[0].toLowerCase(), 'de');
      return 0;
    },

    createCard: function (k, index, section) {
      var card = document.createElement('div');
      card.className = 'kanji-card';
      card.innerHTML =
        '<span class="card-level ' + k.jlpt + '">' + k.jlpt + '</span>' +
        '<span class="card-kanji">' + k.kanji + '</span>' +
        '<span class="card-meaning">' + k.meanings[0] + '</span>';
      card.addEventListener('click', function () { playTick(); section.openDetail(index); });
      return card;
    },

    openDetail: function (k, index, section) {
      detailKanji.textContent = k.kanji;
      detailJlpt.textContent = k.jlpt;
      detailJlpt.className = 'detail-jlpt-badge ' + k.jlpt;
      detailMeanings.textContent = k.meanings.join(', ');
      detailStrokes.textContent = k.strokes + ' Striche';

      if (k.kun && k.kun.length > 0) {
        detailKun.innerHTML = k.kun.map(function (r) {
          return '<div class="reading-item kun"><span class="kana">' + r.kana +
            '</span><span class="romaji">' + r.romaji + '</span></div>';
        }).join('');
      } else {
        detailKun.innerHTML = '<div class="no-reading">Keine Kun-Lesung</div>';
      }

      if (k.on && k.on.length > 0) {
        detailOn.innerHTML = k.on.map(function (r) {
          return '<div class="reading-item on"><span class="kana">' + r.kana +
            '</span><span class="romaji">' + r.romaji + '</span></div>';
        }).join('');
      } else {
        detailOn.innerHTML = '<div class="no-reading">Keine On-Lesung</div>';
      }

      if (k.components && k.components.length > 0) {
        var radicals = sections.radicals ? sections.radicals.allItems : [];
        detailComponents.innerHTML = k.components.map(function (c) {
          var isKangxi = radicals.some(function (r) { return r.radical === c.radical; });
          var cls = isKangxi ? 'component-tag radical-link' : 'component-tag';
          return '<span class="' + cls + '" data-radical="' + c.radical + '" data-kangxi="' + isKangxi + '">' +
            '<span class="comp-radical">' + c.radical + '</span>' +
            '<span class="comp-meaning">' + c.meaning + '</span></span>';
        }).join('');

        detailComponents.querySelectorAll('.component-tag').forEach(function (tag) {
          tag.addEventListener('click', function () {
            var radical = this.getAttribute('data-radical');
            var isKangxi = this.getAttribute('data-kangxi') === 'true';
            section.closeDetail();
            if (isKangxi) {
              openRadicalInTab(radical);
            } else {
              setRadicalFilter(radical, this.querySelector('.comp-meaning').textContent);
            }
          });
        });
      } else {
        detailComponents.innerHTML = '<div class="no-reading">Keine Komponenten</div>';
      }

      if (k.examples && k.examples.length > 0) {
        detailExamples.innerHTML = k.examples.map(function (ex) {
          return '<div class="example-item">' +
            '<span class="example-word">' + ex.word + '</span> ' +
            '<span class="example-reading">' + ex.reading + '</span>' +
            '<div class="example-meaning">' + ex.meaning + '</div></div>';
        }).join('');
      } else {
        detailExamples.innerHTML = '<div class="no-reading">Keine Beispiele</div>';
      }
    }
  });

  // Kanji radical filter (section-specific)
  function setRadicalFilter(radical, meaning) {
    sections.kanji.filterState.radical = radical;
    radicalFilterName.textContent = radical + ' (' + meaning + ')';
    radicalFilter.classList.remove('hidden');
    sections.kanji.applyFilters();
  }

  function clearRadicalFilter() {
    sections.kanji.filterState.radical = null;
    radicalFilter.classList.add('hidden');
    sections.kanji.applyFilters();
  }

  document.getElementById('clear-radical-filter').addEventListener('click', clearRadicalFilter);

  // ==========================================
  // === GRAMMAR SECTION ===
  // ==========================================

  var grammarDetailPattern = document.getElementById('grammar-detail-pattern');
  var grammarDetailLevel = document.getElementById('grammar-detail-level');
  var grammarDetailCategory = document.getElementById('grammar-detail-category');
  var grammarDetailMeaning = document.getElementById('grammar-detail-meaning');
  var grammarDetailFormation = document.getElementById('grammar-detail-formation');
  var grammarDetailExplanation = document.getElementById('grammar-detail-explanation');
  var grammarDetailExamples = document.getElementById('grammar-detail-examples');
  var grammarDetailNotesSection = document.getElementById('grammar-detail-notes-section');
  var grammarDetailNotes = document.getElementById('grammar-detail-notes');
  var grammarDetailRelatedSection = document.getElementById('grammar-detail-related-section');
  var grammarDetailRelated = document.getElementById('grammar-detail-related');

  sections.grammar = new Section({
    name: 'grammar',
    grid: document.getElementById('grammar-grid'),
    searchInput: document.getElementById('grammar-search-input'),
    clearSearchBtn: document.getElementById('grammar-clear-search'),
    sortSelect: document.getElementById('grammar-sort-select'),
    noResults: document.getElementById('grammar-no-results'),
    overlay: document.getElementById('grammar-detail-overlay'),
    closeBtn: document.getElementById('grammar-close-detail'),
    prevBtn: document.getElementById('prev-grammar'),
    nextBtn: document.getElementById('next-grammar'),
    countLabel: 'Grammatik',
    batchSize: 60,
    initialFilters: { level: 'all', category: 'all', sort: 'category' },
    filterGroups: [
      { container: grammarControls, selector: '.grammar-level', dataAttr: 'data-glevel', stateKey: 'level' },
      { container: grammarControls, selector: '.grammar-cat', dataAttr: 'data-category', stateKey: 'category' }
    ],
    playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount,

    filterFn: function (g, query, fs) {
      if (fs.level !== 'all' && g.level !== fs.level) return false;
      if (fs.category !== 'all' && g.category !== fs.category) return false;
      if (query) {
        var mP = g.pattern.toLowerCase().indexOf(query) !== -1;
        var mM = g.meaning.toLowerCase().indexOf(query) !== -1;
        var mE = g.explanation.toLowerCase().indexOf(query) !== -1;
        var mF = g.formation.toLowerCase().indexOf(query) !== -1;
        var mEx = g.examples && g.examples.some(function (ex) {
          return ex.japanese.toLowerCase().indexOf(query) !== -1 ||
            ex.german.toLowerCase().indexOf(query) !== -1 ||
            ex.romaji.toLowerCase().indexOf(query) !== -1;
        });
        if (!mP && !mM && !mE && !mF && !mEx) return false;
      }
      return true;
    },

    sortFn: function (a, b, fs) {
      var catOrder = { 'Partikel': 0, 'Verben': 1, 'Adjektive': 2, 'Satzstrukturen': 3 };
      if (fs.sort === 'category') {
        var ca = catOrder[a.category] !== undefined ? catOrder[a.category] : 9;
        var cb = catOrder[b.category] !== undefined ? catOrder[b.category] : 9;
        if (ca !== cb) return ca - cb;
        return a.pattern.localeCompare(b.pattern, 'ja');
      }
      if (fs.sort === 'level') {
        var la = LEVEL_ORDER[a.level] !== undefined ? LEVEL_ORDER[a.level] : 9;
        var lb = LEVEL_ORDER[b.level] !== undefined ? LEVEL_ORDER[b.level] : 9;
        if (la !== lb) return la - lb;
        return a.pattern.localeCompare(b.pattern, 'ja');
      }
      if (fs.sort === 'alpha') return a.pattern.localeCompare(b.pattern, 'ja');
      return 0;
    },

    createCard: function (g, index, section) {
      var card = document.createElement('div');
      card.className = 'grammar-card';
      var exText = (g.examples && g.examples.length > 0) ? g.examples[0].japanese : '';
      card.innerHTML =
        '<div class="grammar-card-header">' +
          '<span class="grammar-card-pattern">' + g.pattern + '</span>' +
          '<div class="grammar-card-badges">' +
            '<span class="card-level ' + g.level + '">' + g.level + '</span>' +
            '<span class="grammar-card-category ' + g.category + '">' + g.category + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="grammar-card-meaning">' + g.meaning + '</div>' +
        (exText ? '<div class="grammar-card-example">' + exText + '</div>' : '');
      card.addEventListener('click', function () { playTick(); section.openDetail(index); });
      return card;
    },

    openDetail: function (g, index, section) {
      grammarDetailPattern.textContent = g.pattern;
      grammarDetailLevel.textContent = g.level;
      grammarDetailLevel.className = 'detail-jlpt-badge ' + g.level;
      grammarDetailCategory.textContent = g.category;
      grammarDetailCategory.className = 'grammar-category-badge ' + g.category;
      grammarDetailMeaning.textContent = g.meaning;
      grammarDetailFormation.textContent = g.formation;
      grammarDetailExplanation.textContent = g.explanation;

      renderExamples(grammarDetailExamples, g.examples);

      if (g.notes && g.notes.length > 0) {
        grammarDetailNotes.textContent = g.notes;
        grammarDetailNotesSection.classList.remove('hidden');
      } else {
        grammarDetailNotesSection.classList.add('hidden');
      }

      if (g.related && g.related.length > 0) {
        grammarDetailRelated.innerHTML = g.related.map(function (relId) {
          var rel = section.allItems.find(function (item) { return item.id === relId; });
          if (!rel) return '';
          return '<span class="grammar-related-tag" data-id="' + relId + '">' + rel.pattern + '</span>';
        }).filter(function (s) { return s.length > 0; }).join('');

        grammarDetailRelated.querySelectorAll('.grammar-related-tag').forEach(function (tag) {
          tag.addEventListener('click', function () {
            var targetId = this.getAttribute('data-id');
            var targetIndex = section.filteredItems.findIndex(function (item) { return item.id === targetId; });
            if (targetIndex !== -1) {
              section.openDetail(targetIndex);
            } else {
              // Item filtered out — reset category filter and find it
              section.filterState.category = 'all';
              section.searchInput.value = '';
              document.querySelectorAll('.grammar-cat').forEach(function (b) { b.classList.remove('active'); });
              document.querySelector('.grammar-cat[data-category="all"]').classList.add('active');
              section.applyFilters();
              var newIdx = section.filteredItems.findIndex(function (item) { return item.id === targetId; });
              if (newIdx !== -1) section.openDetail(newIdx);
            }
          });
        });

        grammarDetailRelatedSection.classList.remove('hidden');
      } else {
        grammarDetailRelatedSection.classList.add('hidden');
      }
    }
  });

  // ==========================================
  // === VOCAB SECTION ===
  // ==========================================

  var vocabDetailWord = document.getElementById('vocab-detail-word');
  var vocabDetailLevel = document.getElementById('vocab-detail-level');
  var vocabDetailType = document.getElementById('vocab-detail-type');
  var vocabDetailReading = document.getElementById('vocab-detail-reading');
  var vocabDetailRomaji = document.getElementById('vocab-detail-romaji');
  var vocabDetailMeaning = document.getElementById('vocab-detail-meaning');
  var vocabDetailCategoryLine = document.getElementById('vocab-detail-category-line');
  var vocabDetailExamples = document.getElementById('vocab-detail-examples');
  var vocabDetailKanjiSection = document.getElementById('vocab-detail-kanji-section');
  var vocabDetailKanjiLinks = document.getElementById('vocab-detail-kanji-links');

  sections.vocab = new Section({
    name: 'vocab',
    grid: document.getElementById('vocab-grid'),
    searchInput: document.getElementById('vocab-search-input'),
    clearSearchBtn: document.getElementById('vocab-clear-search'),
    sortSelect: document.getElementById('vocab-sort-select'),
    noResults: document.getElementById('vocab-no-results'),
    overlay: document.getElementById('vocab-detail-overlay'),
    closeBtn: document.getElementById('vocab-close-detail'),
    prevBtn: document.getElementById('prev-vocab'),
    nextBtn: document.getElementById('next-vocab'),
    countLabel: 'Vokabeln',
    batchSize: 100,
    initialFilters: { level: 'all', type: 'all', sort: 'level' },
    filterGroups: [
      { container: vocabControls, selector: '.vocab-level', dataAttr: 'data-vlevel', stateKey: 'level' },
      { container: vocabControls, selector: '.vocab-type', dataAttr: 'data-vtype', stateKey: 'type' }
    ],
    playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount,

    filterFn: function (v, query, fs) {
      if (fs.level !== 'all' && v.level !== fs.level) return false;
      if (fs.type !== 'all' && v.type !== fs.type) return false;
      if (query) {
        var mW = v.word.indexOf(query) !== -1;
        var mR = v.reading && v.reading.indexOf(query) !== -1;
        var mRo = v.romaji && v.romaji.toLowerCase().indexOf(query) !== -1;
        var mM = v.meaning.toLowerCase().indexOf(query) !== -1;
        var mC = v.category && v.category.toLowerCase().indexOf(query) !== -1;
        if (!mW && !mR && !mRo && !mM && !mC) return false;
      }
      return true;
    },

    sortFn: function (a, b, fs) {
      var typeOrder = { 'Nomen': 0, 'Verb': 1, 'Adjektiv': 2, 'Adverb': 3, 'Partikel': 4, 'Ausdruck': 5 };
      if (fs.sort === 'level') {
        var la = LEVEL_ORDER[a.level] !== undefined ? LEVEL_ORDER[a.level] : 9;
        var lb = LEVEL_ORDER[b.level] !== undefined ? LEVEL_ORDER[b.level] : 9;
        if (la !== lb) return la - lb;
        return a.word.localeCompare(b.word, 'ja');
      }
      if (fs.sort === 'type') {
        var ta = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 9;
        var tb = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 9;
        if (ta !== tb) return ta - tb;
        return a.word.localeCompare(b.word, 'ja');
      }
      if (fs.sort === 'category') {
        var ca = (a.category || '').localeCompare(b.category || '', 'de');
        if (ca !== 0) return ca;
        return a.word.localeCompare(b.word, 'ja');
      }
      if (fs.sort === 'alpha') return a.meaning.localeCompare(b.meaning, 'de');
      return 0;
    },

    createCard: function (v, index, section) {
      var card = document.createElement('div');
      card.className = 'vocab-card';
      card.innerHTML =
        '<div class="vocab-card-header">' +
          '<span class="vocab-card-word">' + v.word + '</span>' +
          '<div class="vocab-card-badges">' +
            '<span class="card-level ' + v.level + '">' + v.level + '</span>' +
            '<span class="vocab-type-badge ' + v.type + '">' + v.type + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="vocab-card-reading">' + (v.reading || '') + '</div>' +
        '<div class="vocab-card-meaning">' + v.meaning + '</div>';
      card.addEventListener('click', function () { playTick(); section.openDetail(index); });
      return card;
    },

    openDetail: function (v, index, section) {
      vocabDetailWord.textContent = v.word;
      vocabDetailLevel.textContent = v.level;
      vocabDetailLevel.className = 'detail-jlpt-badge ' + v.level;
      vocabDetailType.textContent = v.type;
      vocabDetailType.className = 'vocab-type-badge ' + v.type;
      vocabDetailReading.textContent = v.reading || '';
      vocabDetailRomaji.textContent = v.romaji || '';
      vocabDetailMeaning.textContent = v.meaning;
      vocabDetailCategoryLine.textContent = 'Kategorie: ' + (v.category || '—');

      renderExamples(vocabDetailExamples, v.examples);

      // Kanji links (lazy-load kanji data if needed)
      function renderVocabKanjiLinks() {
        var kanjiChars = [];
        var allKanji = sections.kanji.allItems;
        for (var i = 0; i < v.word.length; i++) {
          var ch = v.word[i];
          if (ch.charCodeAt(0) >= 0x4E00 && ch.charCodeAt(0) <= 0x9FFF) {
            var found = allKanji.find(function (k) { return k.kanji === ch; });
            if (found) kanjiChars.push(found);
          }
        }

        if (kanjiChars.length > 0) {
          vocabDetailKanjiLinks.innerHTML = kanjiChars.map(function (k) {
            return '<span class="component-tag" data-kanji="' + k.kanji + '">' +
              '<span class="comp-radical">' + k.kanji + '</span>' +
              '<span class="comp-meaning">' + k.meanings[0] + '</span></span>';
          }).join('');

          vocabDetailKanjiLinks.querySelectorAll('.component-tag').forEach(function (tag) {
            tag.addEventListener('click', function () {
              var targetKanji = this.getAttribute('data-kanji');
              section.closeDetail();
              openKanjiFromLink(targetKanji);
            });
          });

          vocabDetailKanjiSection.classList.remove('hidden');
        } else {
          vocabDetailKanjiSection.classList.add('hidden');
        }
      }

      if (dataLoaded.kanji) {
        renderVocabKanjiLinks();
      } else {
        vocabDetailKanjiLinks.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>Lade Kanji-Daten...</span></div>';
        vocabDetailKanjiSection.classList.remove('hidden');
        ensureSectionData('kanji', renderVocabKanjiLinks);
      }
    }
  });

  // ==========================================
  // === COUNTERS SECTION ===
  // ==========================================

  var counterDetailKanji = document.getElementById('counter-detail-kanji');
  var counterDetailCat = document.getElementById('counter-detail-cat');
  var counterDetailReading = document.getElementById('counter-detail-reading');
  var counterDetailMeaning = document.getElementById('counter-detail-meaning');
  var counterDetailUsage = document.getElementById('counter-detail-usage');
  var counterDetailQuestion = document.getElementById('counter-detail-question');
  var counterDetailTable = document.getElementById('counter-detail-table');
  var counterDetailSpecialSection = document.getElementById('counter-detail-special-section');
  var counterDetailSpecial = document.getElementById('counter-detail-special');
  var counterDetailExamples = document.getElementById('counter-detail-examples');
  var counterDetailNotesSection = document.getElementById('counter-detail-notes-section');
  var counterDetailNotes = document.getElementById('counter-detail-notes');

  sections.counters = new Section({
    name: 'counters',
    grid: document.getElementById('counters-grid'),
    searchInput: document.getElementById('counters-search-input'),
    clearSearchBtn: document.getElementById('counters-clear-search'),
    noResults: document.getElementById('counters-no-results'),
    overlay: document.getElementById('counter-detail-overlay'),
    closeBtn: document.getElementById('counter-close-detail'),
    prevBtn: document.getElementById('prev-counter'),
    nextBtn: document.getElementById('next-counter'),
    countLabel: 'Zählwörter',
    initialFilters: { category: 'all' },
    filterGroups: [{
      container: countersControls,
      selector: '.counter-cat',
      dataAttr: 'data-ccat',
      stateKey: 'category'
    }],
    playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount,

    filterFn: function (c, query, fs) {
      if (fs.category !== 'all' && c.category !== fs.category) return false;
      if (query) {
        var mK = c.kanji.indexOf(query) !== -1;
        var mR = c.reading.indexOf(query) !== -1;
        var mRo = c.romaji.toLowerCase().indexOf(query) !== -1;
        var mM = c.meaning.toLowerCase().indexOf(query) !== -1;
        var mU = c.usage.toLowerCase().indexOf(query) !== -1;
        var mC = c.counts && c.counts.some(function (ct) {
          return ct.reading.indexOf(query) !== -1 || ct.romaji.toLowerCase().indexOf(query) !== -1 || ct.kanji.indexOf(query) !== -1;
        });
        if (!mK && !mR && !mRo && !mM && !mU && !mC) return false;
      }
      return true;
    },

    createCard: function (c, index, section) {
      var card = document.createElement('div');
      card.className = 'counter-card';
      var previewHtml = '';
      if (c.counts) {
        var previews = c.counts.slice(0, 5).map(function (ct) {
          var cls = ct.shift ? 'counter-card-preview-item has-shift' : 'counter-card-preview-item';
          return '<span class="' + cls + '">' + ct.kanji + '</span>';
        });
        previewHtml = '<div class="counter-card-preview">' + previews.join('') + '</div>';
      }
      card.innerHTML =
        '<div class="counter-card-header">' +
          '<span class="counter-card-kanji">' + c.kanji + '</span>' +
          '<span class="counter-card-badge ' + c.category + '">' + c.category + '</span>' +
        '</div>' +
        '<div class="counter-card-reading">' + c.reading + ' (' + c.romaji + ')</div>' +
        '<div class="counter-card-meaning">' + c.meaning + '</div>' +
        previewHtml;
      card.addEventListener('click', function () { playTick(); section.openDetail(index); });
      return card;
    },

    openDetail: function (c, index, section) {
      counterDetailKanji.textContent = c.kanji;
      counterDetailCat.textContent = c.category;
      counterDetailCat.className = 'counter-category-badge ' + c.category;
      counterDetailReading.textContent = c.reading + ' (' + c.romaji + ')';
      counterDetailMeaning.textContent = c.meaning;
      counterDetailUsage.textContent = c.usage;

      if (c.questionWord) {
        counterDetailQuestion.innerHTML =
          '<span class="counter-question-kanji">' + c.questionWord.kanji + '</span>' +
          '<span class="counter-question-reading">' + c.questionWord.reading + '</span>' +
          '<span class="counter-question-romaji">' + c.questionWord.romaji + '</span>';
      }

      if (c.counts && c.counts.length > 0) {
        var html = '<table class="counter-table"><thead><tr><th>#</th><th>Kanji</th><th>Lesung</th><th>Romaji</th></tr></thead><tbody>';
        c.counts.forEach(function (ct) {
          var rowCls = ct.shift ? ' class="shift-row"' : '';
          var rdg = ct.shift ? '<span class="shift-highlight">' + ct.reading + '</span>' : ct.reading;
          html += '<tr' + rowCls + '><td class="ct-num">' + ct.num + '</td><td class="ct-kanji">' + ct.kanji + '</td><td class="ct-reading">' + rdg + '</td><td class="ct-romaji">' + ct.romaji + '</td></tr>';
        });
        counterDetailTable.innerHTML = html + '</tbody></table>';
      }

      if (c.specialCounts && c.specialCounts.length > 0) {
        counterDetailSpecial.innerHTML = c.specialCounts.map(function (sc) {
          return '<div class="counter-special-item">' +
            '<span class="cs-kanji">' + sc.kanji + '</span>' +
            '<span class="cs-reading">' + sc.reading + '</span>' +
            '<span class="cs-romaji">' + sc.romaji + '</span>' +
            (sc.note ? '<span class="cs-note">' + sc.note + '</span>' : '') +
          '</div>';
        }).join('');
        counterDetailSpecialSection.classList.remove('hidden');
      } else {
        counterDetailSpecialSection.classList.add('hidden');
      }

      renderExamples(counterDetailExamples, c.examples);

      if (c.notes && c.notes.length > 0) {
        counterDetailNotes.textContent = c.notes;
        counterDetailNotesSection.classList.remove('hidden');
      } else {
        counterDetailNotesSection.classList.add('hidden');
      }
    }
  });

  // Counters: basic numbers table (rendered once lazily)
  function renderBasicNumbers() {
    var container = document.getElementById('counters-numbers-section');
    if (!container || container.children.length > 0) return;
    var data = window.COUNTERS_DATA;
    if (!data || !data.basicNumbers) return;

    var section = document.createElement('div');
    section.className = 'counters-numbers-section';
    var header = document.createElement('div');
    header.className = 'counters-numbers-header';
    header.innerHTML = '<span class="tab-icon-kana" style="font-family:var(--font-jp)">数</span> Grundzahlen' +
      '<svg class="toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    var body = document.createElement('div');
    body.className = 'counters-numbers-body';
    var wrapper = document.createElement('div');
    wrapper.className = 'numbers-table-wrapper';
    var table = document.createElement('table');
    table.className = 'numbers-table';
    table.innerHTML = '<thead><tr><th>Zahl</th><th>Kanji</th><th>Hiragana</th><th>Romaji</th><th>Hinweis</th></tr></thead>';
    var tbody = document.createElement('tbody');
    data.basicNumbers.forEach(function (n) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + n.number + '</strong></td>' +
        '<td class="num-kanji">' + n.kanji + '</td>' +
        '<td class="num-hiragana">' + n.hiragana + '</td>' +
        '<td class="num-romaji">' + n.romaji + '</td>' +
        '<td class="num-notes">' + (n.notes || '—') + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    body.appendChild(wrapper);
    header.addEventListener('click', function () {
      playTick();
      header.querySelector('.toggle-icon').classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  }

  // ==========================================
  // === RADICALS SECTION ===
  // ==========================================

  var radicalDetailChar = document.getElementById('radical-detail-char');
  var radicalDetailNumber = document.getElementById('radical-detail-number');
  var radicalDetailMeaning = document.getElementById('radical-detail-meaning');
  var radicalDetailReading = document.getElementById('radical-detail-reading');
  var radicalDetailStrokes = document.getElementById('radical-detail-strokes');
  var radicalDetailKanjiList = document.getElementById('radical-detail-kanji-list');

  sections.radicals = new Section({
    name: 'radicals',
    grid: document.getElementById('radicals-grid'),
    searchInput: document.getElementById('radicals-search-input'),
    clearSearchBtn: document.getElementById('radicals-clear-search'),
    noResults: document.getElementById('radicals-no-results'),
    overlay: document.getElementById('radical-detail-overlay'),
    closeBtn: document.getElementById('radical-close-detail'),
    prevBtn: document.getElementById('prev-radical'),
    nextBtn: document.getElementById('next-radical'),
    countLabel: 'Radikale',
    batchSize: 80,
    initialFilters: { strokes: 'all' },
    filterGroups: [{
      container: radicalsControls,
      selector: '.radical-stroke',
      dataAttr: 'data-rstrokes',
      stateKey: 'strokes'
    }],
    playTick: playTick, playSwoosh: playSwoosh, playPop: playPop, onUpdate: updateCount,

    filterFn: function (r, query, fs) {
      if (fs.strokes !== 'all') {
        if (fs.strokes === '9') { if (r.strokes < 9) return false; }
        else { if (r.strokes !== parseInt(fs.strokes)) return false; }
      }
      if (query) {
        var mR = r.radical.indexOf(query) !== -1;
        var mM = r.meaning.toLowerCase().indexOf(query) !== -1;
        var mRd = r.reading.indexOf(query) !== -1;
        var mRo = r.romaji.toLowerCase().indexOf(query) !== -1;
        var mN = ('' + r.number) === query;
        if (!mR && !mM && !mRd && !mRo && !mN) return false;
      }
      return true;
    },

    createCard: function (r, index, section) {
      var card = document.createElement('div');
      card.className = 'radical-card';
      card.innerHTML =
        '<span class="radical-card-number">#' + r.number + '</span>' +
        '<span class="radical-card-strokes">' + r.strokes + '画</span>' +
        '<span class="radical-card-char">' + r.radical + '</span>' +
        '<span class="radical-card-meaning">' + r.meaning + '</span>' +
        '<span class="radical-card-reading">' + r.reading + '</span>';
      card.addEventListener('click', function () { playTick(); section.openDetail(index); });
      return card;
    },

    openDetail: function (r, index, section) {
      radicalDetailChar.textContent = r.radical;
      radicalDetailNumber.textContent = '#' + r.number + ' von 214';
      radicalDetailMeaning.textContent = r.meaning;
      radicalDetailReading.innerHTML = r.reading + '<span class="romaji"> (' + r.romaji + ')</span>';
      radicalDetailStrokes.textContent = r.strokes + ' Striche';

      function renderRadicalKanjiList() {
        var allKanji = sections.kanji.allItems;
        var matching = allKanji.filter(function (k) {
          return k.components && k.components.some(function (c) { return c.radical === r.radical; });
        });

        if (matching.length > 0) {
          radicalDetailKanjiList.innerHTML = matching.map(function (k) {
            return '<span class="component-tag" data-kanji="' + k.kanji + '">' +
              '<span class="comp-radical">' + k.kanji + '</span>' +
              '<span class="comp-meaning">' + k.meanings[0] + '</span></span>';
          }).join('');

          radicalDetailKanjiList.querySelectorAll('.component-tag').forEach(function (tag) {
            tag.addEventListener('click', function () {
              section.closeDetail();
              openKanjiFromLink(this.getAttribute('data-kanji'));
            });
          });
        } else {
          radicalDetailKanjiList.innerHTML = '<span style="color:var(--text-secondary);font-size:0.9rem;">Keine Kanji mit diesem Radikal in der Datenbank gefunden.</span>';
        }
      }

      if (dataLoaded.kanji) {
        renderRadicalKanjiList();
      } else {
        radicalDetailKanjiList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><span>Lade Kanji-Daten...</span></div>';
        ensureSectionData('kanji', renderRadicalKanjiList);
      }
    }
  });

  // ==========================================
  // === CROSS-SECTION NAVIGATION ===
  // ==========================================

  function openKanjiFromLink(kanji) {
    switchTab('kanji');
    ensureSectionData('kanji', function () {
      sections.kanji.searchInput.value = kanji;
      sections.kanji.clearSearchBtn.classList.add('visible');
      sections.kanji.applyFilters();
      if (sections.kanji.filteredItems.length > 0) sections.kanji.openDetail(0);
    });
  }

  function openRadicalInTab(radicalChar) {
    switchTab('radicals');
    ensureSectionData('radicals', function () {
      sections.radicals.filterState.strokes = 'all';
      sections.radicals.searchInput.value = '';
      document.querySelectorAll('.radical-stroke').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-rstrokes') === 'all');
      });
      sections.radicals.applyFilters();
      for (var i = 0; i < sections.radicals.filteredItems.length; i++) {
        if (sections.radicals.filteredItems[i].radical === radicalChar) {
          sections.radicals.openDetail(i);
          break;
        }
      }
    });
  }

  // ==========================================
  // === TAB SYSTEM ===
  // ==========================================

  var controlsMap = {
    kanji: kanjiControls, grammar: grammarControls, vocab: vocabControls,
    counters: countersControls, radicals: radicalsControls
  };
  var tabMap = {
    kanji: kanjiTab, grammar: grammarTab, vocab: vocabTab,
    counters: countersTab, radicals: radicalsTab,
    hiragana: hiraganaTab, katakana: katakanaTab
  };

  function switchTab(tab) {
    activeTab = tab;
    playSwoosh();

    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    for (var name in controlsMap) {
      controlsMap[name].classList.toggle('hidden', tab !== name);
    }
    for (var name in tabMap) {
      tabMap[name].classList.toggle('hidden', tab !== name);
    }

    if (tab === 'hiragana' || tab === 'katakana') {
      renderKanaTab(tab);
      updateKanaDarkMode();
    } else {
      ensureSectionData(tab, function () {
        if (tab === 'counters' && !countersRendered) {
          renderBasicNumbers();
          countersRendered = true;
        }
        updateCount();
      });
    }

    updateCount();
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(this.getAttribute('data-tab'));
    });
  });

  // ==========================================
  // === KEYBOARD NAVIGATION ===
  // ==========================================

  document.addEventListener('keydown', function (e) {
    for (var i = 0; i < sectionNames.length; i++) {
      var sec = sections[sectionNames[i]];
      if (sec.isOverlayOpen()) {
        if (e.key === 'Escape') sec.closeDetail();
        if (e.key === 'ArrowLeft') sec.navigateDetail(-1);
        if (e.key === 'ArrowRight') sec.navigateDetail(1);
        return;
      }
    }

    if (e.key === '/') {
      if (activeTab === 'hiragana' || activeTab === 'katakana') return;
      var sec = sections[activeTab];
      if (sec && document.activeElement !== sec.searchInput) {
        e.preventDefault();
        sec.searchInput.focus();
      }
    }
  });

  // ==========================================
  // === RANDOM BUTTON ===
  // ==========================================

  randomBtn.addEventListener('click', function () {
    playPop();
    if (activeTab === 'hiragana' || activeTab === 'katakana') return;
    var tab = activeTab;
    ensureSectionData(tab, function () {
      if (sections[tab]) sections[tab].openRandom();
    });
  });

  // ==========================================
  // === THEME ===
  // ==========================================

  function initTheme() {
    var saved = localStorage.getItem('kanji-theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  function toggleTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('kanji-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('kanji-theme', 'dark');
    }
    if (typeof updateKanaDarkMode === 'function') {
      setTimeout(updateKanaDarkMode, 50);
    }
  }

  themeToggle.addEventListener('click', function () { playTick(); toggleTheme(); });

  // Sound toggle
  if (soundToggle) {
    soundToggle.classList.toggle('active', soundEnabled);
    soundToggle.addEventListener('click', function () {
      soundEnabled = !soundEnabled;
      localStorage.setItem('kanji-sound', soundEnabled ? 'on' : 'off');
      soundToggle.classList.toggle('active', soundEnabled);
      if (soundEnabled) playPop();
    });
  }

  // ==========================================
  // === KANA SECTION (Hiragana & Katakana) ===
  // ==========================================

  function buildKanaTable(rows, type, colHeaders, isYoon) {
    var table = document.createElement('table');
    table.className = 'kana-table' + (isYoon ? ' yoon-table' : '');
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    var thLabel = document.createElement('th');
    thLabel.textContent = '';
    headerRow.appendChild(thLabel);
    colHeaders.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var colors = window.KANA_DATA.rowColors;
    rows.forEach(function (rowData) {
      var tr = document.createElement('tr');
      var rowColor = colors[rowData.row] || colors['vowel'];
      var tdLabel = document.createElement('td');
      tdLabel.className = 'kana-row-label';
      tdLabel.textContent = rowData.label;
      tdLabel.style.borderLeft = '3px solid ' + rowColor.color;
      tr.appendChild(tdLabel);

      rowData.chars.forEach(function (ch) {
        var td = document.createElement('td');
        td.className = 'kana-cell';
        if (ch) {
          var inner = document.createElement('div');
          inner.className = 'kana-cell-inner';
          inner.setAttribute('data-row', rowData.row);
          var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          inner.style.background = isDark ? rowColor.darkBg : rowColor.bg;
          inner.style.borderColor = isDark ? rowColor.darkBorder : rowColor.border;
          var charSpan = document.createElement('span');
          charSpan.className = 'kana-char';
          charSpan.textContent = type === 'hiragana' ? ch.h : ch.k;
          var romajiSpan = document.createElement('span');
          romajiSpan.className = 'kana-romaji';
          romajiSpan.textContent = ch.r;
          romajiSpan.style.color = rowColor.color;
          inner.appendChild(charSpan);
          inner.appendChild(romajiSpan);
          inner.addEventListener('click', function () {
            playTick();
            speakKana(type === 'hiragana' ? ch.h : ch.k);
          });
          td.appendChild(inner);
        } else {
          var empty = document.createElement('div');
          empty.className = 'kana-cell-empty';
          td.appendChild(empty);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function speakKana(char) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(char);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.8;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }

  function createKanaSection(title, icon, rows, type, colHeaders, isYoon) {
    var section = document.createElement('div');
    section.className = 'kana-section';
    var header = document.createElement('div');
    header.className = 'kana-section-header';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'kana-section-icon';
    iconSpan.textContent = icon;
    header.appendChild(iconSpan);
    var titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    header.appendChild(titleSpan);
    section.appendChild(header);
    var wrapper = document.createElement('div');
    wrapper.className = 'kana-table-wrapper';
    wrapper.appendChild(buildKanaTable(rows, type, colHeaders, isYoon));
    section.appendChild(wrapper);
    return section;
  }

  function renderKanaTab(type) {
    var container = document.getElementById(type + '-content');
    if (!container || container.children.length > 0) return;
    var data = window.KANA_DATA;
    if (!data) return;

    var vowelHeaders = ['a', 'i', 'u', 'e', 'o'];
    var yoonHeaders = ['ya', 'yu', 'yo'];
    var basisIcon = type === 'hiragana' ? 'あ' : 'ア';
    container.appendChild(createKanaSection('Basis (Gojūon)', basisIcon, data.gojuon, type, vowelHeaders, false));
    var dakutenIcon = type === 'hiragana' ? 'が' : 'ガ';
    container.appendChild(createKanaSection('Dakuten / Handakuten', dakutenIcon, data.dakuten, type, vowelHeaders, false));
    var yoonIcon = type === 'hiragana' ? 'きゃ' : 'キャ';
    container.appendChild(createKanaSection('Kombinationen (Yōon)', yoonIcon, data.yoon, type, yoonHeaders, true));
  }

  function updateKanaDarkMode() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var colors = window.KANA_DATA ? window.KANA_DATA.rowColors : null;
    if (!colors) return;
    document.querySelectorAll('.kana-cell-inner').forEach(function (cell) {
      var rowKey = cell.getAttribute('data-row');
      if (rowKey && colors[rowKey]) {
        cell.style.background = isDark ? colors[rowKey].darkBg : colors[rowKey].bg;
        cell.style.borderColor = isDark ? colors[rowKey].darkBorder : colors[rowKey].border;
      }
    });
  }

  // ==========================================
  // === INIT ===
  // ==========================================

  initTheme();
  renderKanaTab('hiragana');
  updateKanaDarkMode();
})();
