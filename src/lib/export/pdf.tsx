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

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.35,
    color: "#000",
  },
  name: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 3,
  },
  headline: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 3,
  },
  contact: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 8,
  },
  contactLink: {
    color: "#0563C1",
    textDecoration: "underline",
  },
  section: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 3,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 2,
  },
  body: {
    marginBottom: 2,
  },
  jobHeader: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 1,
  },
  bullet: {
    marginLeft: 8,
    marginBottom: 1,
  },
  skillLabel: {
    fontFamily: "Helvetica-Bold",
  },
});

function ContactLine({ resume }: { resume: StructuredResume }) {
  const plain: string[] = [];
  if (resume.contact.email) plain.push(resume.contact.email);
  if (resume.contact.phone) plain.push(resume.contact.phone);
  if (resume.contact.location) plain.push(resume.contact.location);

  const nodes: React.ReactNode[] = [];
  if (plain.length) {
    nodes.push(<Text key="plain">{plain.join(" | ")}</Text>);
  }

  resume.contact.links.forEach((link, i) => {
    if (nodes.length || i > 0) {
      nodes.push(<Text key={`sep-${i}`}>{" | "}</Text>);
    }
    nodes.push(
      <Link key={link.url} src={link.url} style={styles.contactLink}>
        {link.label}
      </Link>,
    );
  });

  return <Text style={styles.contact}>{nodes}</Text>;
}

function ResumeDocument({ resume }: { resume: StructuredResume }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.contact.fullName}</Text>
        {resume.headline ? (
          <Text style={styles.headline}>{resume.headline}</Text>
        ) : null}
        <ContactLine resume={resume} />

        {resume.summary ? (
          <View>
            <Text style={styles.section}>Professional Summary</Text>
            <Text style={styles.body}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.skills.length > 0 ? (
          <View>
            <Text style={styles.section}>Technical Skills</Text>
            {resume.skills.map((g) => (
              <Text key={g.category} style={styles.body}>
                <Text style={styles.skillLabel}>{g.category}: </Text>
                {g.items.join(" | ")}
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

        {resume.experience.length > 0 ? (
          <View>
            <Text style={styles.section}>Professional Experience</Text>
            {resume.experience.map((job, idx) => (
              <View key={`${job.company}-${idx}`}>
                <Text style={styles.jobHeader}>
                  {`${job.company} — ${job.title} | ${job.start} – ${job.end}${job.location ? ` | ${job.location}` : ""}`}
                </Text>
                {job.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`- ${b}`}
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
                  {p.url ? " | " : ""}
                  {p.url ? (
                    <Link src={p.url} style={styles.contactLink}>
                      {p.url.replace(/^https?:\/\//, "")}
                    </Link>
                  ) : null}
                </Text>
                {p.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {`- ${b}`}
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
                {`${e.degree} — ${e.school}${e.dates ? ` | ${e.dates}` : ""}${e.details ? ` | ${e.details}` : ""}`}
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

export async function buildPdfBuffer(resume: StructuredResume): Promise<Buffer> {
  const instance = pdf(<ResumeDocument resume={resume} />);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
