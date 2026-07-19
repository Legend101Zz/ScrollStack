import type { ReaderProjectView } from "@/lib/fixtures/reader-adapter";

export const readerProjectFixture: ReaderProjectView = {
  bookId: "the-harbour-bell",
  bookTitle: "The Harbour Bell",
  chapterLabel: "Chapter seven: The Wrong Hour",
  pages: [
    {
      id: "page-01",
      pageNumber: 1,
      sourceLabel: "Source pages 112-114",
      panels: [
        {
          id: "panel-01",
          layout: "standard",
          visual: "harbour",
          bubbles: [
            {
              anchor: "bottom-left",
              id: "narration-01",
              kind: "narration",
              text: "Morning came the colour of old paper.",
            },
          ],
        },
        {
          id: "panel-02",
          layout: "standard",
          visual: "letter",
          bubbles: [
            {
              anchor: "top-right",
              id: "dialogue-01",
              kind: "dialogue",
              text: "You came back.",
            },
          ],
        },
        {
          id: "panel-03",
          layout: "wide",
          visual: "bell",
          sfx: "GORON",
          bubbles: [
            {
              anchor: "bottom-right",
              id: "dialogue-02",
              kind: "dialogue",
              text: "I told you the bell would find us both.",
            },
          ],
        },
        {
          id: "panel-04",
          layout: "standard",
          visual: "silence",
          bubbles: [
            {
              anchor: "bottom-left",
              id: "narration-02",
              kind: "narration",
              text: "Silence. Then footsteps.",
            },
          ],
        },
        {
          id: "panel-05",
          layout: "impact",
          visual: "stairs",
          bubbles: [
            {
              anchor: "top-right",
              id: "dialogue-03",
              kind: "dialogue",
              text: "Do not turn around.",
            },
          ],
        },
      ],
    },
    {
      id: "page-02",
      pageNumber: 2,
      sourceLabel: "Source pages 115-117",
      panels: [
        {
          id: "panel-06",
          layout: "wide",
          visual: "stairs",
          bubbles: [
            {
              anchor: "top-left",
              id: "narration-03",
              kind: "narration",
              text: "Mira kept her eyes on the rain-dark steps.",
            },
          ],
        },
        {
          id: "panel-07",
          layout: "tall",
          visual: "letter",
          bubbles: [
            {
              anchor: "top-right",
              id: "dialogue-04",
              kind: "dialogue",
              text: "Who sent it?",
            },
          ],
        },
        {
          id: "panel-08",
          layout: "standard",
          visual: "harbour",
          bubbles: [],
        },
        {
          id: "panel-09",
          image: {
            alt: "Mira holding a sealed letter beneath the observatory bell and telescope",
            height: 1672,
            objectPosition: "center 38%",
            src: "/art/last-observatory-key-panel.png",
            width: 941,
          },
          layout: "impact",
          visual: "bell",
          sfx: "KRAK",
          bubbles: [
            {
              anchor: "bottom-left",
              id: "dialogue-05",
              kind: "dialogue",
              text: "It knows you read the name.",
            },
          ],
        },
      ],
    },
  ],
  projectId: "manga-harbour-01",
  receipt: {
    pageRange: "112-117",
    sourceName: "The Harbour Bell.pdf",
  },
};

export const libraryFixture = [
  {
    bookId: readerProjectFixture.bookId,
    bookTitle: readerProjectFixture.bookTitle,
    chapterLabel: readerProjectFixture.chapterLabel,
    pageLabel: "Page 4 of 22",
    projectId: readerProjectFixture.projectId,
    sourceRange: readerProjectFixture.receipt.pageRange,
  },
];
