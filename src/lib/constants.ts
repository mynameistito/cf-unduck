export const MAX_HISTORY = 500;
export const ANIMATION_DURATION_MS = 375;

export const LS_KEYS = {
  CUSTOM_BANGS: "custom-bangs",
  DEFAULT_BANG: "default-bang",
  HISTORY_ENABLED: "history-enabled",
  SEARCH_COUNT: "search-count",
  SEARCH_HISTORY: "search-history",
  SOUND_ENABLED: "sound-enabled",
} as const;

export const CUTIES = {
  DOWN: ["(↓°□°)↓", "(´◕‿◕)↓", "↓(´・ω・)↓"],
  IDLE: "┐( ˘_˘ )┌",
  LEFT: ["╰（°□°╰）", "(◕‿◕´)", "(・ω・´)"],
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
  RIGHT: ["(╯°□°）╯", "(｀◕‿◕)", "(｀・ω・)"],
  UP: ["(↑°□°)↑", "(´◕‿◕)↑", "↑(´・ω・)↑"],
} as const;

export const DEFAULT_BANG_SHORTCUT = "ddg";
