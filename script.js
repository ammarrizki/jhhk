'use strict';

(() => {
  const content = window.GDT_CONTENT;
  if (!content) return;
  document.documentElement.classList.add('js');

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const make = (tag, className = '', value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const safeImage = (path) => typeof path === 'string' && /^assets\/[a-zA-Z0-9_/-]+\.(webp|png|jpe?g)$/.test(path) && !path.includes('..') ? path : 'assets/mecha.webp';
  const externalLink = (link, url) => {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.hidden = false;
  };
  const dateLabel = (value) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));

  // Mobile navigation keeps normal anchor behavior and keyboard access.
  const menu = $('.menu-toggle');
  const navigation = $('#navigation');
  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
  $$('.service-strip a').forEach((link) => link.addEventListener('click', () => {
    const details = document.getElementById(link.hash.slice(1));
    if (details instanceof HTMLDetailsElement) details.open = true;
  }));

  // Contact is enabled only with an approved, validated international number.
  const contact = content.contact;
  const validPhone = /^[1-9]\d{7,14}$/.test(contact.whatsapp);
  const contactLink = $('#contact-link');
  let selectedService = '';
  function setOrderContext(service = '') {
    selectedService = service;
    const message = 'Halo GDT WORKS, saya ingin konsultasi ' + (service ? 'layanan ' + service : 'pengerjaan kit Gundam') + '. Mohon informasi proses dan estimasinya.';
    if (validPhone) externalLink(contactLink, 'https://wa.me/' + contact.whatsapp + '?text=' + encodeURIComponent(message));
    $('#order-context').textContent = service ? 'Layanan pilihan: ' + service + (validPhone ? '. Sertakan jenis dan kondisi kit saat menghubungi admin.' : '. Kontak admin menunggu konfirmasi.') : '';
  }
  if (validPhone) {
    $('#contact-info').textContent = 'Hubungi admin untuk konsultasi dan pemesanan.';
    $('#contact-number').textContent = '+' + contact.whatsapp;
    $('#contact-number').hidden = false;
    $('#contact-unavailable').hidden = true;
    setOrderContext();
  }
  $$('[data-order-service]').forEach((link) => link.addEventListener('click', () => setOrderContext(link.dataset.orderService)));

  // Portfolio data is compiled before deployment; no private records reach this file.
  const projects = content.projects;
  const grid = $('#project-grid');
  const dialog = $('#project-dialog');
  let lastOpener = null;
  let focusAfterClose = null;
  const allConcepts = projects.length > 0 && projects.every((project) => project.concept);
  $('.filter[data-filter="all"] span').textContent = String(projects.length).padStart(2, '0');
  if (projects.length && !projects.some((project) => project.concept)) $('#portfolio-notice').hidden = true;
  if (projects.some((project) => project.concept) && !allConcepts) {
    $('#portfolio-notice p').textContent = 'Galeri memuat proyek yang telah disetujui dan eksplorasi konsep. Setiap visual konsep AI diberi label.';
  }
  function showProject(project, opener) {
    lastOpener = opener;
    focusAfterClose = null;
    selectedService = project.label;
    $('#dialog-category').textContent = project.label;
    $('#dialog-title').textContent = project.title;
    $('#dialog-description').textContent = project.description;
    $('#dialog-status').textContent = project.status;
    $('#dialog-focus').textContent = project.focus;
    $('#dialog-result').textContent = project.result;
    $('#dialog-note').textContent = project.concept
      ? 'Ilustrasi konsep AI untuk pengenalan layanan. Bukan dokumentasi hasil proyek atau bukti hasil pelanggan.'
      : 'Dokumentasi yang telah disetujui untuk publikasi.';
    $('#dialog-image').src = safeImage(project.image);
    $('#dialog-image').alt = project.alt;
    dialog.showModal();
    document.body.classList.add('modal-open');
    $('.dialog-close').focus();
  }
  projects.forEach((project, index) => {
    const card = make('article', 'project-card');
    card.dataset.category = project.category;
    const button = make('button', 'project-button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Lihat detail: ' + project.title);
    button.setAttribute('aria-haspopup', 'dialog');
    const visual = make('div', 'project-image');
    const img = make('img');
    img.src = safeImage(project.image);
    img.alt = project.alt;
    img.width = 1536;
    img.height = 1024;
    img.loading = 'lazy';
    img.decoding = 'async';
    const number = make('span', 'project-image-number', '[' + String(index + 1).padStart(2, '0') + ']');
    number.setAttribute('aria-hidden', 'true');
    const arrow = make('span', 'project-open', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    visual.append(img, make('span', 'concept-label', project.concept ? 'KONSEP / AI' : 'PROYEK PILIHAN'), number, arrow);
    const meta = make('div', 'project-meta');
    meta.append(make('h3', '', project.title), make('span', 'project-category', project.label));
    button.append(visual, meta, make('p', 'project-subtitle', project.subtitle));
    button.addEventListener('click', () => showProject(project, button));
    card.append(button);
    grid.append(card);
  });
  function filterProjects(category, announce = true) {
    const cards = $$('.project-card');
    let visible = 0;
    cards.forEach((card) => {
      const matches = category === 'all' || card.dataset.category === category;
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    grid.classList.toggle('is-filtered', category !== 'all');
    const unit = allConcepts ? 'KONSEP' : 'ENTRI';
    $('#portfolio-count').textContent = String(visible).padStart(2, '0') + ' ' + unit;
    $('#portfolio-empty').hidden = visible > 0;
    if (announce) $('#filter-status').textContent = visible + ' entri ditampilkan.';
    $$('.filter').forEach((filter) => {
      const active = filter.dataset.filter === category;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
  }
  $$('.filter').forEach((button) => button.addEventListener('click', () => filterProjects(button.dataset.filter)));
  filterProjects('all', false);
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    (focusAfterClose || lastOpener)?.focus({ preventScroll: Boolean(focusAfterClose) });
    focusAfterClose = null;
  });
  $('#dialog-contact').addEventListener('click', (event) => {
    event.preventDefault();
    setOrderContext(selectedService);
    focusAfterClose = $('#contact-title');
    dialog.close();
    $('#kontak').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });

  // Only records compiled as public are present. Dates and stages are factual input.
  const progressFeed = $('#progress-feed');
  content.progress.forEach((entry) => {
    const card = make('article', 'progress-card');
    if (entry.image) {
      const img = make('img');
      img.src = safeImage(entry.image);
      img.alt = entry.alt;
      img.loading = 'lazy';
      img.width = 1536;
      img.height = 1024;
      card.append(img);
    }
    card.append(make('span', 'mono', entry.projectCode), make('h3', '', entry.title), make('p', '', entry.description));
    const updated = make('time', 'progress-date', dateLabel(entry.date));
    updated.dateTime = entry.date;
    card.append(make('div', 'progress-stage', entry.stage), updated);
    if (entry.timeline.length) {
      const timeline = make('ol', 'progress-timeline');
      entry.timeline.forEach((step) => {
        const item = make('li');
        const time = make('time', 'progress-date', dateLabel(step.date));
        time.dateTime = step.date;
        item.append(time, make('h4', '', step.stage), make('p', '', step.description));
        timeline.append(item);
      });
      card.append(timeline);
    }
    progressFeed.append(card);
  });
  $('#progress-empty').hidden = content.progress.length > 0;

  const tabs = $$('[role="tab"]');
  function selectStep(index, focus = false) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    const step = content.steps[index];
    const number = String(index + 1).padStart(2, '0');
    $('#process-number').textContent = number;
    $('#process-fraction').textContent = number + ' / 05';
    $('#process-name').textContent = step.title;
    $('#process-description').textContent = step.description;
    $('#process-panel').setAttribute('aria-labelledby', 'step-' + index);
    if (focus) tabs[index].focus();
    if (!reducedMotion.matches) $('#process-number').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240 });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectStep(index));
    tab.addEventListener('keydown', (event) => {
      let next = index;
      if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectStep(next, true);
    });
  });

  // Click-to-load map. No map network request happens before a visitor opts in.
  if (contact.address) $('#address-info').textContent = contact.address;
  if (contact.hours) $('#hours-info').textContent = contact.hours;
  let directions = '';
  try {
    const url = new URL(contact.mapsUrl);
    if (url.protocol === 'https:' && ['www.google.com', 'maps.google.com', 'maps.app.goo.gl'].includes(url.hostname) && !url.username && !url.password && (!url.port || url.port === '443')) directions = url.href;
  } catch { /* Unconfigured location stays unavailable. */ }
  const hasCoordinates = Number.isFinite(contact.latitude) && Number.isFinite(contact.longitude)
    && Math.abs(contact.latitude) <= 90 && Math.abs(contact.longitude) <= 180;
  if (hasCoordinates) {
    const point = contact.latitude + ',' + contact.longitude;
    if (!directions) directions = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(point);
    $('#map-heading').textContent = 'Temukan workshop kami.';
    $('#map-explanation').textContent = 'Peta dimuat dari Google Maps setelah Anda memilih Tampilkan peta.';
    const loadButton = $('#load-map');
    loadButton.hidden = false;
    loadButton.addEventListener('click', () => {
      const frame = make('iframe', 'map-frame');
      frame.title = 'Peta lokasi GDT WORKS';
      frame.referrerPolicy = 'no-referrer';
      frame.loading = 'eager';
      frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(point) + '&z=16&output=embed';
      const placeholder = $('#map-placeholder');
      frame.addEventListener('load', () => { placeholder.hidden = true; });
      frame.addEventListener('error', () => {
        frame.remove();
        placeholder.hidden = false;
        $('#map-heading').textContent = 'Peta tidak dapat dimuat.';
        $('#map-explanation').textContent = 'Gunakan tautan Petunjuk arah untuk membuka lokasi di Google Maps.';
      });
      $('#map-panel').append(frame);
      loadButton.hidden = true;
    }, { once: true });
  }
  if (directions) externalLink($('#maps-link'), directions);
  if (directions && !hasCoordinates) {
    $('#map-heading').textContent = 'Lokasi tersedia di Google Maps.';
    $('#map-explanation').textContent = 'Gunakan Petunjuk arah untuk membuka titik workshop.';
  }

  // Lightweight 2.5D image movement; no WebGL, autoplay video, or scroll hijacking.
  const heroStage = $('#hero-stage');
  const heroFigure = $('#hero-figure');
  const motionButton = $('#motion-toggle');
  let motionPaused = reducedMotion.matches;
  function updateMotion() {
    document.documentElement.classList.toggle('motion-paused', motionPaused || reducedMotion.matches);
    motionButton.hidden = reducedMotion.matches;
    motionButton.setAttribute('aria-pressed', String(motionPaused));
    motionButton.firstChild.textContent = motionPaused ? 'Aktifkan gerakan ' : 'Jeda gerakan ';
  }
  motionButton.addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });
  reducedMotion.addEventListener('change', () => { motionPaused = reducedMotion.matches; updateMotion(); });
  updateMotion();
  heroStage.addEventListener('pointermove', (event) => {
    if (motionPaused || reducedMotion.matches || !finePointer.matches) return;
    const rect = heroStage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    heroFigure.style.setProperty('--tilt-y', (x * 5).toFixed(2) + 'deg');
    heroFigure.style.setProperty('--tilt-x', (-y * 3).toFixed(2) + 'deg');
  });
  heroStage.addEventListener('pointerleave', () => {
    heroFigure.style.setProperty('--tilt-x', '0deg');
    heroFigure.style.setProperty('--tilt-y', '0deg');
  });
  const navLinks = [...navigation.querySelectorAll('a')];
  const navSections = navLinks.map((link) => document.getElementById(link.hash.slice(1)));
  let scrollScheduled = false;
  function onScroll() {
    scrollScheduled = false;
    const rect = $('#beranda').getBoundingClientRect();
    if (!motionPaused && !reducedMotion.matches && rect.bottom > 0 && rect.top < innerHeight) {
      heroFigure.style.setProperty('--hero-y', Math.min(22, Math.max(-22, -rect.top * .025)).toFixed(1) + 'px');
    }
    let active = -1;
    navSections.forEach((section, index) => { if (section.getBoundingClientRect().top < innerHeight * .4) active = index; });
    navLinks.forEach((link, index) => { if (index === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (!reducedMotion.matches && !motionPaused) entry.target.animate([{ opacity: .5, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'ease-out' });
        observer.unobserve(entry.target);
      });
    }, { threshold: .12 });
    $$('.section-heading,.about-copy,.services-heading,.progress-empty').forEach((element) => observer.observe(element));
  }
})();
