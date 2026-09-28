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

function hr() {
  return {
    bottom: {
      style: BorderStyle.SINGLE,
      size: 6,
      color: "000000",
      space: 1,
    },
  };
}

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    border: hr(),
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        font: "Calibri",
      }),
    ],
  });
}

function body(text: string, opts?: { bold?: boolean; before?: number }) {
  return new Paragraph({
    spacing: { before: opts?.before ?? 0, after: 40, line: 276 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: 20,
        font: "Calibri",
      }),
    ],
  });
}

function bullet(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 20, line: 276 },
    indent: { left: 120 },
    children: [
      new TextRun({
        text: `- ${text}`,
        size: 20,
        font: "Calibri",
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
      new TextRun({ text: parts.join(" | "), size: 20, font: "Calibri" }),
    );
  }

  resume.contact.links.forEach((link, i) => {
    if (children.length || i > 0) {
      children.push(new TextRun({ text: " | ", size: 20, font: "Calibri" }));
    }
    children.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: link.label,
            style: "Hyperlink",
            size: 20,
            font: "Calibri",
            color: "0563C1",
            underline: {},
          }),
        ],
        link: link.url,
      }),
    );
  });

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
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
          text: resume.contact.fullName,
          bold: true,
          size: 32,
          font: "Calibri",
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
            size: 22,
            font: "Calibri",
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
          spacing: { after: 40, line: 276 },
          children: [
            new TextRun({
              text: `${group.category}: `,
              bold: true,
              size: 20,
              font: "Calibri",
            }),
            new TextRun({
              text: group.items.join(" | "),
              size: 20,
              font: "Calibri",
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
      const header = `${job.company} — ${job.title} | ${job.start} – ${job.end}${job.location ? ` | ${job.location}` : ""}`;
      children.push(body(header, { bold: true, before: 80 }));
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
          size: 20,
          font: "Calibri",
        }),
      ];
      if (project.url) {
        runs.push(new TextRun({ text: " | ", size: 20, font: "Calibri" }));
        runs.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: project.url.replace(/^https?:\/\//, ""),
                style: "Hyperlink",
                size: 20,
                font: "Calibri",
                color: "0563C1",
                underline: {},
              }),
            ],
            link: project.url,
          }),
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
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
          `${edu.degree} — ${edu.school}${edu.dates ? ` | ${edu.dates}` : ""}${edu.details ? ` | ${edu.details}` : ""}`,
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
