/* storage.js — FINAL (Do NOT change anything) */

const Storage = {
  saveLevel(level) {
    try {
      localStorage.setItem("antSurvival_level", level);
    } catch (e) { console.warn("Level save failed", e); }
  },

  loadLevel() {
    try {
      const v = localStorage.getItem("antSurvival_level");
      return v ? parseInt(v) : 1;
    } catch (e) { return 1; }
  },

  saveHighScore(score) {
    try {
      localStorage.setItem("antSurvival_highscore", score);
    } catch (e) { console.warn("Highscore save failed", e); }
  },

  loadHighScore() {
    try {
      const v = localStorage.getItem("antSurvival_highscore");
      return v ? parseInt(v) : 0;
    } catch (e) { return 0; }
  }
};
