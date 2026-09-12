"use strict";
import form from "./form.js";
import skillbar from "./skillbar.js";

document.addEventListener("DOMContentLoaded", () => {
  const seasonTheme = {
    spring: {
      secondary: "#5d9c68",
      tertiary: "#b7d79a",
      soft: "#dcefd8",
    },
    summer: {
      secondary: "#e6b34a",
      tertiary: "#f6d777",
      soft: "#f8e7aa",
    },
    fall: {
      secondary: "#d0663c",
      tertiary: "#dca36c",
      soft: "#f0d0ad",
    },
    winter: {
      secondary: "#4c79a8",
      tertiary: "#9ec0d9",
      soft: "#d9ebf7",
    },
  };

  const getSeason = () => {
    const month = new Date().getMonth() + 1;

    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    if (month >= 9 && month <= 11) return "fall";
    return "winter";
  };

  const applySeasonTheme = (selectedSeason = getSeason()) => {
    const palette = seasonTheme[selectedSeason];

    document.documentElement.style.setProperty("--secondary-accent", palette.secondary);
    document.documentElement.style.setProperty("--tertiary-accent", palette.tertiary);
    document.documentElement.style.setProperty("--soft-accent", palette.soft);
  };

  applySeasonTheme();

  const updateMouseShift = (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 24;
    const y = (event.clientY / window.innerHeight - 0.5) * 24;

    document.documentElement.style.setProperty("--mouse-shift-x", `${x}px`);
    document.documentElement.style.setProperty("--mouse-shift-y", `${y}px`);
  };

  window.addEventListener("pointermove", updateMouseShift, { passive: true });
  document.body.classList.add("page-ready");

  AOS.init({
    once: true,
  });
  form();
  skillbar();

  const nav = document.querySelector("#nav");
  const navBtn = document.querySelector("#nav-btn");
  const navBtnImg = document.querySelector("#nav-btn-img");

  //Hamburger menu
  navBtn.onclick = () => {
    if (nav.classList.toggle("open")) {
      navBtnImg.src = "img/icons/close.svg";
    } else {
      navBtnImg.src = "img/icons/open.svg";
    }
  };

  window.addEventListener("scroll", function () {
    const header = document.querySelector("#header");
    const hero = document.querySelector("#home");
    let triggerHeight = hero.offsetHeight - 170;

    if (window.scrollY > triggerHeight) {
      header.classList.add("header-sticky");
      goToTop.classList.add("reveal");
    } else {
      header.classList.remove("header-sticky");
      goToTop.classList.remove("reveal");
    }
  });

  let sections = document.querySelectorAll("section");
  let navLinks = document.querySelectorAll("header nav a");

  window.onscroll = () => {
    sections.forEach((sec) => {
      let top = window.scrollY;
      let offset = sec.offsetTop - 170;
      let height = sec.offsetHeight;
      let id = sec.getAttribute("id");

      if (top >= offset && top < offset + height) {
        navLinks.forEach((links) => {
          links.classList.remove("active");
          document
            .querySelector("header nav a[href*=" + id + "]")
            .classList.add("active");
        });
      }
    });
  };
});
