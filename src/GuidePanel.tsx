import { useEffect, useRef, type ReactNode } from "react";
import { t, type MessageKey } from "./i18n";
import type { GuideBeat } from "./guide";
import {
  GuideAddButton,
  GuideAncestors,
  GuideCollapse,
  GuideDeceased,
  GuideDivorce,
  GuideDynasty,
  GuideDynastyForm,
  GuideExportChoice,
  GuideExportForm,
  GuideFamily,
  GuideHistoryList,
  GuideHistoryNav,
  GuideLayoutTabs,
  GuideLayouts,
  GuideLibrary,
  GuideMemberRow,
  GuideMembersNav,
  GuideMenu,
  GuideMenuShot,
  GuideMergeNav,
  GuideMergePreview,
  GuideNewMember,
  GuidePartner,
  GuidePartnerMenu,
  GuidePortrait,
  GuideProfile,
  GuideRemoveAsk,
  GuideSearchHit,
  GuideStillCard,
  GuideTidy,
  GuideTransfer,
  GuideTreesNav,
  GuideUndo,
  GuideZoom,
} from "./GuideScenes";

const chapters = [
  "person",
  "menu",
  "canvas",
  "dynasty",
  "trees",
  "keep",
] as const;

type Chapter = (typeof chapters)[number];

export function GuideBeatCard({
  beat,
  onNext,
  onSkip,
}: {
  beat: GuideBeat;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [beat]);
  return (
    <aside
      ref={ref}
      className="guide-beat"
      tabIndex={-1}
      role="region"
      aria-labelledby="guide-beat-title"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onSkip();
        }
      }}
    >
      <h2 id="guide-beat-title">{t(beatTitle[beat])}</h2>
      {beat === "empty" && <GuideAddButton />}
      {beat === "person" && <GuideStillCard />}
      {beat === "menu" && <GuideMenu />}
      {beat === "layouts" && <GuideLayouts />}
      <p>{t(beatBody[beat])}</p>
      <div className="actions">
        <button type="button" onClick={onSkip}>
          {t("guideSkip")}
        </button>
        <button type="button" className="primary" onClick={onNext}>
          {t("guideNext")}
        </button>
      </div>
    </aside>
  );
}

export function GuideBook({
  chapter,
  onChapter,
}: {
  chapter: Chapter;
  onChapter: (chapter: Chapter) => void;
}) {
  return (
    <>
      <div className="guide-tabs" role="tablist" aria-label={t("guideTitle")}>
        {chapters.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={chapter === id}
            className={chapter === id ? "active" : ""}
            onClick={() => onChapter(id)}
          >
            {t(chapterLabel[id])}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="guide-chapter">
        {chapter === "person" && (
          <div className="guide-steps">
            <Step title={t("guideStepAddTitle")} body={t("guideStepAddBody")}>
              <GuideAddButton />
            </Step>
            <Step
              stack
              title={t("guideStepFormTitle")}
              body={t("guideStepFormBody")}
            >
              <GuideNewMember />
            </Step>
            <Step
              title={t("guideStepPortraitTitle")}
              body={t("guideStepPortraitBody")}
            >
              <GuidePortrait />
            </Step>
            <Step
              stack
              title={t("guideStepProfileTitle")}
              body={t("guideStepProfileBody")}
            >
              <GuideProfile />
            </Step>
            <Step
              title={t("guideStepFamilyTitle")}
              body={t("guideStepFamilyBody")}
            >
              <GuideFamily />
            </Step>
            <Step
              title={t("guideStepMembersTitle")}
              body={t("guideStepMembersBody")}
            >
              <div className="guide-shots">
                <GuideMembersNav />
                <GuideMemberRow />
              </div>
            </Step>
          </div>
        )}
        {chapter === "menu" && (
          <div className="guide-steps">
            <Step
              stack
              title={t("guideStepMenuTitle")}
              body={t("guideStepMenuBody")}
            >
              <GuideMenuShot />
            </Step>
            <Step
              stack
              title={t("guideStepPartnerMenuTitle")}
              body={t("guideStepPartnerMenuBody")}
            >
              <GuidePartnerMenu />
            </Step>
            <Step
              title={t("guideStepAncestorsTitle")}
              body={t("guideStepAncestorsBody")}
            >
              <GuideAncestors />
            </Step>
            <Step
              title={t("guideStepDeathTitle")}
              body={t("guideStepDeathBody")}
            >
              <GuideDeceased />
            </Step>
            <Step
              stack
              title={t("guideStepDivorceTitle")}
              body={t("guideStepDivorceBody")}
            >
              <GuideDivorce />
            </Step>
            <Step
              stack
              title={t("guideStepRemoveTitle")}
              body={t("guideStepRemoveBody")}
            >
              <GuideRemoveAsk />
            </Step>
          </div>
        )}
        {chapter === "canvas" && (
          <div className="guide-steps">
            <Step
              stack
              title={t("guideStepLayoutsTitle")}
              body={t("guideStepLayoutsBody")}
            >
              <div className="guide-shots">
                <GuideLayoutTabs />
                <GuideLayouts />
              </div>
            </Step>
            <Step
              stack
              title={t("guideStepTidyTitle")}
              body={t("guideStepTidyBody")}
            >
              <div className="guide-shots">
                <GuideZoom />
                <GuideTidy />
              </div>
            </Step>
            <Step
              title={t("guideStepCollapseTitle")}
              body={t("guideStepCollapseBody")}
            >
              <GuideCollapse />
            </Step>
            <Step
              stack
              title={t("guideStepSearchTitle")}
              body={t("guideStepSearchBody")}
            >
              <GuideSearchHit />
            </Step>
            <Step
              title={t("guideStepSlotTitle")}
              body={t("guideStepSlotBody")}
            >
              <GuidePartner />
            </Step>
          </div>
        )}
        {chapter === "dynasty" && (
          <div className="guide-steps">
            <Step
              stack
              title={t("guideStepDynastyTitle")}
              body={t("guideStepDynastyBody")}
            >
              <GuideDynasty />
            </Step>
            <Step
              stack
              title={t("guideStepDynastyFormTitle")}
              body={t("guideStepDynastyFormBody")}
            >
              <GuideDynastyForm />
            </Step>
          </div>
        )}
        {chapter === "trees" && (
          <div className="guide-steps">
            <Step
              stack
              title={t("guideStepTreesTitle")}
              body={t("guideStepTreesBody")}
            >
              <div className="guide-shots">
                <GuideTreesNav />
                <GuideLibrary />
              </div>
            </Step>
            <Step
              stack
              title={t("guideStepMergeTitle")}
              body={t("guideStepMergeBody")}
            >
              <div className="guide-shots">
                <GuideMergeNav />
                <GuideMergePreview />
              </div>
            </Step>
          </div>
        )}
        {chapter === "keep" && (
          <div className="guide-steps">
            <Step
              title={t("guideStepUndoTitle")}
              body={t("guideStepUndoBody")}
            >
              <GuideUndo />
            </Step>
            <Step
              stack
              title={t("guideStepHistoryTitle")}
              body={t("guideStepHistoryBody")}
            >
              <div className="guide-shots">
                <GuideHistoryNav />
                <GuideHistoryList />
              </div>
            </Step>
            <Step
              stack
              title={t("guideStepExportTitle")}
              body={t("guideStepExportBody")}
            >
              <div className="guide-shots">
                <GuideTransfer />
                <GuideExportChoice />
                <GuideExportForm />
              </div>
            </Step>
          </div>
        )}
      </div>
    </>
  );
}

export type { Chapter as GuideChapter };

const beatTitle: Record<GuideBeat, MessageKey> = {
  empty: "guideBeatEmptyTitle",
  person: "guideBeatPersonTitle",
  menu: "guideBeatMenuTitle",
  layouts: "guideBeatLayoutsTitle",
};

const beatBody: Record<GuideBeat, MessageKey> = {
  empty: "guideBeatEmptyBody",
  person: "guideBeatPersonBody",
  menu: "guideBeatMenuBody",
  layouts: "guideBeatLayoutsBody",
};

const chapterLabel: Record<Chapter, MessageKey> = {
  person: "guideChapterPerson",
  menu: "guideChapterMenu",
  canvas: "guideChapterCanvas",
  dynasty: "guideChapterDynasty",
  trees: "guideChapterTrees",
  keep: "guideChapterKeep",
};

function Step({
  title,
  body,
  children,
  stack = false,
}: {
  title: string;
  body: string;
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <figure className={stack ? "guide-step stack" : "guide-step"}>
      <div className="guide-step-visual">{children}</div>
      <figcaption>
        <strong>{title}</strong>
        <span>{body}</span>
      </figcaption>
    </figure>
  );
}
