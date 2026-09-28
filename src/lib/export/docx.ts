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

const FONT = "Calibri";
const BODY = 20; // 10pt
const SMALL = 18; // 9pt

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

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: hr(),
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 21,
        font: FONT,
        color: "111111",
      }),
    ],
  });
}

function body(text: string, opts?: { bold?: boolean; before?: number; size?: number }) {
  return new Paragraph({
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
}

function bullet(text: string) {
  return new Paragraph({
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
}

function contactParagraph(resume: StructuredResume) {
  const children: (TextRun | ExternalHyperlink)[] = [];
  const parts: string[] = [];
  if (resume.contact.email) parts.push(resume.contact.email);
  if (resume.contact.phone) parts.push(resume.contact.phone);
  if (resume.contact.location) parts.push(resume.contact.location);

  if (parts.length) {
    children.push(
      new TextRun({ text: parts.join("  ·  "), size: SMALL, font: FONT }),
    );
  }

  resume.contact.links.forEach((link, i) => {
    if (children.length || i > 0) {
      children.push(new TextRun({ text: "  ·  ", size: SMALL, font: FONT }));
    }
    children.push(
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

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children,
  });
}

export async function buildDocxBuffer(resume: StructuredResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: resume.contact.fullName.toUpperCase(),
          bold: true,
          size: 36,
          font: FONT,
          color: "111111",
        }),
      ],
    }),
  );

  if (resume.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: resume.headline,
            bold: true,
            size: 21,
            font: FONT,
            color: "222222",
          }),
        ],
      }),
    );
  }

  children.push(contactParagraph(resume));

  if (resume.summary) {
    children.push(sectionTitle("Professional Summary"));
    children.push(body(resume.summary));
  }

  if (resume.skills.length) {
    children.push(sectionTitle("Technical Skills"));
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
      children.push(
        body(`${job.company} — ${job.title}`, { bold: true, before: 100 }),
      );
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
        new TextRun({
          text: project.name,
          bold: true,
          size: BODY,
          font: FONT,
        }),
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
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 28 },
          children: runs,
        }),
      );
      for (const b of project.bullets) children.push(bullet(b));
    }
  }

  if (resume.education.length) {
    children.push(sectionTitle("Education"));
    for (const edu of resume.education) {
      children.push(
        body(
          `${edu.degree} — ${edu.school}${edu.dates ? `  ·  ${edu.dates}` : ""}${edu.details ? `  ·  ${edu.details}` : ""}`,
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
            margin: {
              top: 720,
              bottom: 720,
              left: 864,
              right: 864,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
