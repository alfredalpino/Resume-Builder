import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { StructuredResume } from "@/lib/schema";
import {
  DEFAULT_RESUME_STYLE,
  pdfFontFamily,
  type ResumeStyle,
} from "@/lib/style";

function makeStyles(style: ResumeStyle) {
  const fonts = pdfFontFamily(style);
  const body = style.fontSize;
  const name = body + 6.5;
  const section = body + 0.5;
  const contact = Math.max(8, body - 1);
  const headline = body + 0.5;

  return StyleSheet.create({
    page: {
      paddingTop: 32,
      paddingBottom: 32,
      paddingHorizontal: 40,
      fontFamily: fonts.regular,
      fontSize: body,
      lineHeight: 1.35,
      color: "#111111",
    },
    name: {
      fontSize: name,
      fontFamily: fonts.bold,
      textAlign: "center",
      letterSpacing: 0.4,
      marginBottom: 3,
    },
    headline: {
      fontSize: headline,
      fontFamily: fonts.bold,
      textAlign: "center",
      color: "#222222",
      marginBottom: 3,
    },
    contact: {
      fontSize: contact,
      textAlign: "center",
      marginBottom: 10,
      color: "#222222",
    },
    contactLink: {
      color: "#0B57D0",
      textDecoration: "none",
    },
    section: {
      fontSize: section,
      fontFamily: fonts.bold,
      marginTop: 10,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      borderBottomWidth: 1,
      borderBottomColor: "#111111",
      paddingBottom: 2,
    },
    body: {
      marginBottom: 3,
      textAlign: "justify",
    },
    jobHeader: {
      fontFamily: fonts.bold,
      fontSize: body,
      marginTop: 5,
      marginBottom: 1,
    },
    meta: {
      fontSize: Math.max(8, body - 1),
      marginBottom: 2,
      color: "#333333",
    },
    bullet: {
      marginLeft: 10,
      marginBottom: 2,
    },
  });
}

function ContactLine({
  resume,
  styles,
}: {
  resume: StructuredResume;
  styles: ReturnType<typeof makeStyles>;
}) {
  const plain: string[] = [];
  if (resume.contact.location) plain.push(resume.contact.location);
  if (resume.contact.email) plain.push(resume.contact.email);
  if (resume.contact.phone) plain.push(resume.contact.phone);

  const nodes: React.ReactNode[] = [];
  if (plain.length) {
    nodes.push(<Text key="plain">{plain.join("  ·  ")}</Text>);
  }

  resume.contact.links.forEach((link, i) => {
    if (nodes.length || i > 0) {
      nodes.push(<Text key={`sep-${i}`}>{"  ·  "}</Text>);
    }
    nodes.push(
      <Link key={link.url} src={link.url} style={styles.contactLink}>
        {link.label}
      </Link>,
    );
  });

  return <Text style={styles.contact}>{nodes}</Text>;
}

function ResumeDocument({
  resume,
  style,
}: {
  resume: StructuredResume;
  style: ResumeStyle;
}) {
  const styles = makeStyles(style);
  const showHeadline = style.showHeadline && Boolean(resume.headline?.trim());

  return (
    <Document
      title={`${resume.contact.fullName} Resume`}
      author={resume.contact.fullName}
      subject="ATS Resume"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{resume.contact.fullName.toUpperCase()}</Text>
        {showHeadline ? <Text style={styles.headline}>{resume.headline}</Text> : null}
        <ContactLine resume={resume} styles={styles} />

        {resume.summary ? (
          <View>
            <Text style={styles.section}>Professional Summary</Text>
            <Text style={styles.body}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.skills.length > 0 ? (
          <View>
            <Text style={styles.section}>Skills</Text>
            {resume.skills.map((g) => (
              <Text key={g.category} style={styles.body}>
                {`${g.category}: ${g.items.join(" · ")}`}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.certifications.length > 0 ? (
          <View>
            <Text style={styles.section}>Certifications</Text>
            {resume.certifications.map((c) => (
              <Text key={c} style={styles.body}>
                {c}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.awards && resume.awards.length > 0 ? (
          <View>
            <Text style={styles.section}>Awards</Text>
            {resume.awards.map((a) => (
              <Text key={a} style={styles.body}>
                {a}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.experience.length > 0 ? (
          <View>
            <Text style={styles.section}>Professional Experience</Text>
            {resume.experience.map((job, idx) => (
              <View key={`${job.company}-${idx}`}>
                <Text style={styles.jobHeader}>
                  {`${job.company} — ${job.title}`}
                </Text>
                <Text style={styles.meta}>
                  {`${job.start} – ${job.end}${job.location ? `  ·  ${job.location}` : ""}`}
                </Text>
                {job.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`• ${b}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {resume.projects.length > 0 ? (
          <View>
            <Text style={styles.section}>Projects</Text>
            {resume.projects.map((p, idx) => (
              <View key={`${p.name}-${idx}`}>
                <Text style={styles.jobHeader}>
                  {p.name}
                  {p.url ? "  ·  " : ""}
                  {p.url ? (
                    <Link src={p.url} style={styles.contactLink}>
                      {p.url.replace(/^https?:\/\//, "")}
                    </Link>
                  ) : null}
                </Text>
                {p.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`• ${b}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {resume.education.length > 0 ? (
          <View>
            <Text style={styles.section}>Education</Text>
            {resume.education.map((e, idx) => (
              <Text key={`${e.school}-${idx}`} style={styles.body}>
                {`${
                  e.degree.trim().toLowerCase() === e.school.trim().toLowerCase()
                    ? e.degree
                    : `${e.degree} — ${e.school}`
                }${e.dates ? `  ·  ${e.dates}` : ""}${e.details ? `  ·  ${e.details}` : ""}`}
              </Text>
            ))}
          </View>
        ) : null}

        {resume.extras && resume.extras.length > 0 ? (
          <View>
            <Text style={styles.section}>Additional</Text>
            {resume.extras.map((e) => (
              <Text key={e} style={styles.body}>
                {e}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function buildPdfBuffer(
  resume: StructuredResume,
  style: ResumeStyle = DEFAULT_RESUME_STYLE,
): Promise<Buffer> {
  const instance = pdf(<ResumeDocument resume={resume} style={style} />);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}

export async function buildCoverLetterPdfBuffer(
  letter: string,
  authorName: string,
  style: ResumeStyle = DEFAULT_RESUME_STYLE,
): Promise<Buffer> {
  const fonts = pdfFontFamily(style);
  const styles = StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 48,
      paddingHorizontal: 54,
      fontFamily: fonts.regular,
      fontSize: style.fontSize,
      lineHeight: 1.45,
      color: "#111111",
    },
    para: { marginBottom: 10 },
  });

  const paragraphs = letter.split(/\n\n+/);

  const doc = (
    <Document title={`${authorName} Cover Letter`} author={authorName}>
      <Page size="A4" style={styles.page}>
        {paragraphs.map((block, i) => (
          <Text key={i} style={styles.para}>
            {block}
          </Text>
        ))}
      </Page>
    </Document>
  );

  const instance = pdf(doc);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
