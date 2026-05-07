export const MAX_HISTORY = 500;
export const ANIMATION_DURATION_MS = 375;

export const LS_KEYS = {
  SEARCH_HISTORY: "search-history",
  SEARCH_COUNT: "search-count",
  HISTORY_ENABLED: "history-enabled",
  DEFAULT_BANG: "default-bang",
  CUSTOM_BANGS: "custom-bangs",
  SOUND_ENABLED: "sound-enabled",
} as const;

export const CUTIES = {
  NOTFOUND: [
    "(╯︵╰,)",
    "(｡•́︿•̀｡)",
    "(⊙_☉)",
    "(╯°□°）╯︵ ┻━┻",
    "(ಥ﹏ಥ)",
    "(✿◕‿◕✿)",
    "(╥﹏╥)",
    "(✧ω✧)",
    "(•́_•̀)",
  ],
  IDLE: "┐( ˘_˘ )┌",
  LEFT: ["╰（°□°╰）", "(◕‿◕´)", "(・ω・´)"],
  RIGHT: ["(╯°□°）╯", "(｀◕‿◕)", "(｀・ω・)"],
  UP: ["(↑°□°)↑", "(´◕‿◕)↑", "↑(´・ω・)↑"],
  DOWN: ["(↓°□°)↓", "(´◕‿◕)↓", "↓(´・ω・)↓"],
} as const;

export const DEFAULT_BANG_SHORTCUT = "ddg";
