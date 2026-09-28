import {
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  AlignmentType,
} from "docx";
import type { StructuredResume } from "@/lib/schema";
import {
  DEFAULT_RESUME_STYLE,
  docxFontFamily,
  halfPt,
  type ResumeStyle,
} from "@/lib/style";

function hr() {
  return {
    bottom: {
      style: BorderStyle.SINGLE,
      size: 12,
      color: "111111",
      space: 1,
    },
  };
}

export async function buildDocxBuffer(
  resume: StructuredResume,
  style: ResumeStyle = DEFAULT_RESUME_STYLE,
): Promise<Buffer> {
  const FONT = docxFontFamily(style);
  const BODY = halfPt(style.fontSize);
  const SMALL = halfPt(Math.max(8, style.fontSize - 1));
  const NAME = halfPt(style.fontSize + 8);
  const SECTION = halfPt(style.fontSize + 0.5);

  const sectionTitle = (text: string) =>
    new Paragraph({
      spacing: { before: 200, after: 80 },
      border: hr(),
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          size: SECTION,
          font: FONT,
          color: "111111",
        }),
      ],
    });

  const body = (text: string, opts?: { bold?: boolean; before?: number; size?: number }) =>
    new Paragraph({
      spacing: { before: opts?.before ?? 0, after: 48, line: 276 },
      children: [
        new TextRun({
          text,
          bold: opts?.bold,
          size: opts?.size ?? BODY,
          font: FONT,
          color: "111111",
        }),
      ],
    });

  const bullet = (text: string) =>
    new Paragraph({
      spacing: { before: 0, after: 28, line: 276 },
      indent: { left: 180 },
      children: [
        new TextRun({
          text: `• ${text}`,
          size: BODY,
          font: FONT,
          color: "111111",
        }),
      ],
    });

  const contactChildren: (TextRun | ExternalHyperlink)[] = [];
  const parts: string[] = [];
  if (resume.contact.location) parts.push(resume.contact.location);
  if (resume.contact.email) parts.push(resume.contact.email);
  if (resume.contact.phone) parts.push(resume.contact.phone);
  if (parts.length) {
    contactChildren.push(new TextRun({ text: parts.join("  ·  "), size: SMALL, font: FONT }));
  }
  resume.contact.links.forEach((link, i) => {
    if (contactChildren.length || i > 0) {
      contactChildren.push(new TextRun({ text: "  ·  ", size: SMALL, font: FONT }));
    }
    contactChildren.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: link.label,
            style: "Hyperlink",
            size: SMALL,
            font: FONT,
            color: "0B57D0",
            underline: {},
          }),
        ],
        link: link.url,
      }),
    );
  });

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: resume.contact.fullName.toUpperCase(),
          bold: true,
          size: NAME,
          font: FONT,
          color: "111111",
        }),
      ],
    }),
  );

  if (style.showHeadline && resume.headline?.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: resume.headline,
            bold: true,
            size: BODY + 1,
            font: FONT,
            color: "222222",
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: contactChildren,
    }),
  );

  if (resume.summary) {
    children.push(sectionTitle("Professional Summary"));
    children.push(body(resume.summary));
  }

  if (resume.skills.length) {
    children.push(sectionTitle("Skills"));
    for (const group of resume.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 48, line: 276 },
          children: [
            new TextRun({
              text: `${group.category}: `,
              bold: true,
              size: BODY,
              font: FONT,
            }),
            new TextRun({
              text: group.items.join(" · "),
              size: BODY,
              font: FONT,
            }),
          ],
        }),
      );
    }
  }

  if (resume.certifications.length) {
    children.push(sectionTitle("Certifications"));
    for (const c of resume.certifications) children.push(body(c));
  }

  if (resume.experience.length) {
    children.push(sectionTitle("Professional Experience"));
    for (const job of resume.experience) {
      children.push(body(`${job.company} — ${job.title}`, { bold: true, before: 100 }));
      children.push(
        body(
          `${job.start} – ${job.end}${job.location ? `  ·  ${job.location}` : ""}`,
          { size: SMALL },
        ),
      );
      for (const b of job.bullets) children.push(bullet(b));
    }
  }

  if (resume.projects.length) {
    children.push(sectionTitle("Projects"));
    for (const project of resume.projects) {
      const runs: (TextRun | ExternalHyperlink)[] = [
        new TextRun({ text: project.name, bold: true, size: BODY, font: FONT }),
      ];
      if (project.url) {
        runs.push(new TextRun({ text: "  ·  ", size: BODY, font: FONT }));
        runs.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: project.url.replace(/^https?:\/\//, ""),
                style: "Hyperlink",
                size: BODY,
                font: FONT,
                color: "0B57D0",
                underline: {},
              }),
            ],
            link: project.url,
          }),
        );
      }
      children.push(new Paragraph({ spacing: { before: 80, after: 28 }, children: runs }));
      for (const b of project.bullets) children.push(bullet(b));
    }
  }

  if (resume.education.length) {
    children.push(sectionTitle("Education"));
    for (const edu of resume.education) {
      children.push(
        body(
          `${
            edu.degree.trim().toLowerCase() === edu.school.trim().toLowerCase()
              ? edu.degree
              : `${edu.degree} — ${edu.school}`
          }${edu.dates ? `  ·  ${edu.dates}` : ""}${edu.details ? `  ·  ${edu.details}` : ""}`,
        ),
      );
    }
  }

  if (resume.extras?.length) {
    children.push(sectionTitle("Additional"));
    for (const e of resume.extras) children.push(body(e));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 864, right: 864 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildCoverLetterDocxBuffer(
  letter: string,
  style: ResumeStyle = DEFAULT_RESUME_STYLE,
): Promise<Buffer> {
  const FONT = docxFontFamily(style);
  const BODY = halfPt(style.fontSize);
  const children = letter.split(/\n\n+/).map(
    (block) =>
      new Paragraph({
        spacing: { after: 160, line: 300 },
        children: [
          new TextRun({
            text: block,
            size: BODY,
            font: FONT,
            color: "111111",
          }),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 864, bottom: 864, left: 1008, right: 1008 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
