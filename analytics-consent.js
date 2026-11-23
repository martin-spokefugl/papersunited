"use strict";

// Shared consent and analytics handling for Papers United.
(() => {
  const consentKey = "papers-united-analytics-consent-v1";
  const measurementId = "G-5XR0RRHLLH";

  const banner = document.querySelector("#consent-banner");
  const settings = document.querySelector("#privacy-settings");
  const accept = document.querySelector("#consent-accept");
  const decline = document.querySelector("#consent-decline");

  if (!banner || !settings || !accept || !decline) {
    console.warn("Analytics consent elements are missing.");
    return;
  }

  let choice = null;
  let analyticsLoaded = false;

  try {
    choice = localStorage.getItem(consentKey);
  } catch {
    // Storage may be unavailable.
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;

    // Disable Google Analytics in local development.
    const hostname = window.location.hostname;

    if (hostname !== "papersunited.com" &&
        hostname !== "www.papersunited.com") {
      console.info("Google Analytics disabled in development.");
      return;
    }

    analyticsLoaded = true;
    window[`ga-disable-${measurementId}`] = false;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      anonymize_ip: true
    });

    const script = document.createElement("script");
    script.async = true;
    script.src =
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;

    document.head.append(script);
  }

  function saveChoice(value) {
    const wasLoaded = analyticsLoaded;
    choice = value;

    try {
      localStorage.setItem(consentKey, value);
    } catch {
      // Consent applies to this page visit.
    }

    banner.hidden = true;

    if (value === "accepted") {
      loadAnalytics();
    } else {
      window[`ga-disable-${measurementId}`] = true;

      if (wasLoaded) {
        window.location.reload();
      }
    }
  }

  accept.addEventListener("click", () => saveChoice("accepted"));
  decline.addEventListener("click", () => saveChoice("declined"));

  settings.addEventListener("click", () => {
    banner.hidden = false;
    decline.focus();
  });

  if (choice === "accepted") {
    loadAnalytics();
  } else if (choice !== "declined") {
    banner.hidden = false;
  }
})();

