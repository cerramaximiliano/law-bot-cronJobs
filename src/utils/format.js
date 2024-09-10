function escapeMarkdownV2(text) {
    return text.replace(
      /(\_|\.|\*|\[|\]|\(|\)|~|`|>|#|\+|-|=|\||\{|\}|!)/g,
      "\\$1"
    );
  }
  
  module.exports = escapeMarkdownV2;
  