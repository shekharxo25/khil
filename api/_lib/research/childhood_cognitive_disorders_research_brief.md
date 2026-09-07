# Research Brief: Cognitive & Neurodevelopmental Disorders in Children — For Preemptive Screening App Development

Prepared for: Allen, MICA — PMC 2025
Date: September 6, 2026

This brief collects recent research papers, reviews, and validation studies relevant to building an app that helps parents perform preliminary screening for cognitive/neurodevelopmental disorders in children and connects them to professionals for follow-up. Papers are grouped by theme, with a one-line note on why each is relevant to the product.

---

## 1. Scale of the problem: prevalence and burden

These establish the need for a screening app by quantifying how common these conditions are and how the burden is changing.

- **Trends and cross-country inequalities in the global burden of neurodevelopmental disorders among children aged 0–14 from 1990 to 2021** (Frontiers in Public Health, 2025). Uses Global Burden of Disease data to track prevalence trends and inequality across countries — useful for framing market need and targeting underserved regions.
  [Frontiers](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1609254/full) | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12433988/) | [PubMed](https://pubmed.ncbi.nlm.nih.gov/40959611/)

- **Global trends in developmental disabilities in children and adolescents 1990–2021: sex- and sociodemographic index-stratified analysis of Global Burden of Disease 2021** (Taylor & Francis, 2025). Breaks down disability burden by sex and socioeconomic status — relevant for equity-focused screening design and identifying which populations most need low-cost app-based tools.
  [Taylor & Francis](https://www.tandfonline.com/doi/full/10.1080/20473869.2025.2581660)

- **Review: Co-occurring psychiatric disorders and symptomatology among children and adolescents with neurodevelopmental disorders — an umbrella review with individual study meta-analysis** (Child and Adolescent Mental Health, 2025). Documents how frequently neurodevelopmental disorders co-occur with other psychiatric conditions — important for designing screening logic that doesn't treat conditions in isolation.
  [Wiley](https://acamh.onlinelibrary.wiley.com/doi/10.1111/camh.70093)

---

## 2. Foundational developmental screening approaches (non-digital baseline)

These are the clinical standards an app-based tool would need to reference, adapt, or improve on.

- **Promoting Optimal Development: Identifying Infants and Young Children With Developmental Disorders Through Developmental Surveillance and Screening** (Pediatrics / American Academy of Pediatrics, policy statement). The AAP's core guidance on periodic developmental surveillance and standardized screening — the clinical baseline any app should align with.
  [AAP/Pediatrics](https://publications.aap.org/pediatrics/article/145/1/e20193449/36971)

- **Approach to Developmental Screening and Surveillance in Young Children** (American Family Physician, 2025). Practical primary-care framework for when and how screening should happen — useful for mapping your app's screening cadence to real-world pediatric visit schedules.
  [AAFP](https://www.aafp.org/afp/2025/0700/developmental-screening-young-children)

- **Early identification of children with developmental disabilities** (PubMed, foundational). Classic reference on why early identification matters for outcomes — useful background/citation for the app's value proposition.
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/11055313/)

- **Early detection of neurodevelopmental disorders in children with delayed milestones: navigating between overlapping trajectories and the limits of a single-diagnosis categorical approach (CONDOR Cohort, preliminary study)** (ScienceDirect, 2025). Argues against rigid single-diagnosis screening — relevant to designing an app that flags "developmental concern" broadly rather than trying to diagnose a specific disorder.
  [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1876201825002047)

---

## 3. Autism spectrum disorder (ASD) — screening & digital tools

Autism has the most mature body of digital-screening research, so it's a strong model for your app's design.

- **Early detection of autism using digital behavioral phenotyping** (Nature Medicine, 2023). Landmark study using smartphone-recorded video/behavioral analysis to flag autism risk in toddlers — directly relevant as a technical model for camera/sensor-based screening.
  [Nature Medicine](https://www.nature.com/articles/s41591-023-02574-3)

- **Digital Autism Screening Tool Could Enhance Early Identification** (NIMH science update, 2024) and **Media Advisory: Digital autism screening tool shows promise in NIH-funded study** (NICHD, 2023) — cover the NIH/Duke/Princeton "SenseToKnow" tablet-based tool that measures eye-gaze, facial expression, and motor behavior via a device's front camera during short games.
  [NIMH](https://www.nimh.nih.gov/news/science-updates/2024/digital-autism-screening-tool-could-enhance-early-identification) | [NICHD](https://www.nichd.nih.gov/newsroom/news/100223-autism-screening) | [Duke Pratt](https://pratt.duke.edu/news/autism-app-2023/) | [NIH Research Matters](https://www.nih.gov/news-events/nih-research-matters/app-aids-early-screening-autism)

- **Princeton-led study: Digital screening tool distinguishes autism from ADHD** (Princeton Engineering, 2026) and **Princeton-Led Study Shows Autism Screening Tool Works Despite ADHD** — recent follow-up work on the same tool addressing a key clinical problem (symptom overlap between ASD and ADHD), directly relevant to differential-screening logic.
  [Princeton Engineering](https://engineering.princeton.edu/news/2026/08/17/digital-screening-tool-distinguishes-autism-adhd) | [Community News](https://communitynews.org/science-tech/princeton-sensetoknow-autism-adhd-screening-study/)

- **New tablet-based tools to spot autism draw excitement — and questions** (The Transmitter, journalistic overview). Balanced look at the promise and current limitations of tablet-based autism screening — useful for anticipating criticism/limitations of your own app.
  [The Transmitter](https://www.thetransmitter.org/spectrum/new-tablet-based-tools-to-spot-autism-draw-excitement-and-questions/)

- **Mobile Application for Tracking Children with Autistic Spectrum Disorder: Content Validation and Usability** (PMC, 2024). Directly relevant methods paper on validating a parent-facing ASD tracking app — good template for your own validation study design.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11675099/)

- **Validation of the Modified Checklist for Autism in Toddlers (M-CHAT): A Replication Study of Diagnostic Accuracy** (Journal of Autism and Developmental Disorders, 2026). Updated accuracy data for the most widely-used parent-report autism screener — the clinical instrument most app-based ASD screeners are built around or compared against.
  [Springer](https://link.springer.com/article/10.1007/s10803-026-07330-3)

- **Implementation of M-CHAT for Screening of Early Signs of Autism in the Brazilian Health Care System: A Feasibility Study** (PMC, 2025). Real-world, resource-constrained-setting feasibility data — relevant if the app targets regions with limited specialist access (directly applicable to India/MICA context).
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12029837/)

- **Developing a simplified measure to predict the risk of autism spectrum disorders: Abbreviating the M-CHAT-R using a machine learning approach in China** (ScienceDirect, 2025). Shows how ML can shorten a validated screener without losing accuracy — directly useful for designing a fast, low-friction in-app questionnaire.
  [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0165178125000022)

- **Do Autism-Specific and General Developmental Screens Have Complementary Clinical Value?** (PMC, 2023). Evidence for combining a general developmental screen with a disorder-specific one — relevant to whether your app should run a broad screen first, then branch.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10214166/)

- **Risk Assessment for Parents Who Suspect Their Child Has Autism Spectrum Disorder: Machine Learning Approach** (Journal of Medical Internet Research, 2018). Early precedent for a parent-facing, ML-based risk-assessment tool — close conceptual match to your app's stated purpose.
  [JMIR](https://www.jmir.org/2018/4/e134/)

---

## 4. ADHD — digital markers and screening

- **Identifying Digital Markers of Attention-Deficit/Hyperactivity Disorder (ADHD) in a Remote Monitoring Setting: Prospective Observational Study** (JMIR Formative Research, 2025). Shows passive smartphone/wearable data can surface ADHD-related behavioral markers remotely — relevant to any passive-monitoring feature beyond questionnaires.
  [JMIR Formative Research](https://formative.jmir.org/2025/1/e54531) | [ScienceDirect](https://www.sciencedirect.com/org/science/article/pii/S2561326X25001209)

- **Auxiliary Diagnosis of Children With Attention-Deficit/Hyperactivity Disorder Using Eye-Tracking and Digital Biomarkers: Case-Control Study** (JMIR mHealth and uHealth, 2024). Eye-tracking-based digital biomarkers for ADHD — a lower-cost analog to formal neuropsych testing that could inform an in-app "mini-game" assessment.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11645504/) | [DOI](https://doi.org/10.2196/58927)

- **Predicting ADHD Symptoms Using Smartphone Sensing Data** (ACM UbiComp/ISWC Adjunct Proceedings, 2022). Uses passive smartphone sensor data (not self-report) to predict ADHD symptoms — a technical reference for parent-device-based passive screening.
  [ACM Digital Library](https://dl.acm.org/doi/10.1145/3544793.3563430)

- **A Digital Tool for Assessing the Distinct Effects of Depression, Anxiety, and ADHD on Children's Emotional Cognitive Bias: Cross-Sectional Study** (Journal of Medical Internet Research, 2026). Digital tool disentangling overlapping conditions (depression/anxiety/ADHD) via cognitive-bias tasks — relevant to differential screening design.
  [JMIR](https://www.jmir.org/2026/1/e86286/citations)

---

## 5. Learning disorders (dyslexia, dyscalculia, dysgraphia) — gamified & AI screening

- **A Gamified Approach for Screening and Intervention of Dyslexia, Dysgraphia and Dyscalculia** (IEEE Conference Publication, 2019; 38+ citations). Widely-cited framework for game-based screening across three learning disorders — a strong design template for a child-facing (rather than purely parent-report) screening module.
  [IEEE Xplore](https://ieeexplore.ieee.org/abstract/document/9103336/) | [ResearchGate PDF](https://www.researchgate.net/publication/341761280_A_Gamified_Approach_for_Screening_and_Intervention_of_Dyslexia_Dysgraphia_and_Dyscalculia)

- **Predicting risk of dyslexia with an online gamified test** (PLOS ONE, 2020). Validated online game-based dyslexia risk predictor — directly transferable design pattern and validation methodology.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7710040/) | [PLOS ONE full text](https://journals.plos.org/plosone/article/file?type=printable&id=10.1371%2Fjournal.pone.0241687) | [PubMed](https://pubmed.ncbi.nlm.nih.gov/33264301/)

- **Efficient Deep Learning Model for Detecting Dyslexia in Children from an Online Gamified Test Dataset** (ScienceOpen/Journal of Disability Research, 2024). Applies deep learning to gamified-test data for dyslexia detection — relevant if the app plans an ML-scored mini-game rather than a static questionnaire.
  [ScienceOpen](https://www.scienceopen.com/hosted-document?doi=10.57197/JDR-2024-0099)

- **AI-Enhanced Dyscalculia Screening: A Survey of Methods and Applications for Children** (PMC, 2023). Survey of AI/ML methods specifically for dyscalculia screening — useful literature map if the app expands beyond ASD/ADHD into math-learning disorders.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11241753/)

---

## 6. Connecting parents to professionals: telehealth & referral pathways

This is the "second half" of your app's value proposition — once a risk is flagged, how does the parent get to a professional?

- **A systematic review of telehealth screening, assessment, and diagnosis of autism spectrum disorder** (PMC, 2022). Reviews evidence for telehealth-delivered assessment/diagnosis following screening — core evidence base for a screen-then-refer-to-teleconsult flow.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9547568/)

- **Telehealth for Neurodevelopmental Assessment and Intervention** (American Academy of Pediatrics, promising-practices guide). Practical guidance on what neurodevelopmental services can be delivered via telehealth — useful for scoping which professional-connection features are clinically appropriate.
  [AAP](https://www.aap.org/en/practice-management/care-delivery-approaches/telehealth/promising-practices/telehealth-for-neurodevelopmental-assessment-and-intervention/)

- **Early Intervention for Children With Developmental Disabilities and Their Families via Telehealth: Systematic Review** (ScienceDirect, 2025). Evidence on telehealth-delivered early-intervention services (not just diagnosis) — relevant if the app also wants to connect families to ongoing therapy, not just initial referral.
  [ScienceDirect](https://www.sciencedirect.com/org/science/article/pii/S1438887125000780)

- **Types of telehealth services for infants and toddlers** (Telehealth.HHS.gov, practice guide). US government reference outlining concrete telehealth service categories for this age group — useful for feature/service taxonomy.
  [Telehealth.HHS.gov](https://telehealth.hhs.gov/providers/best-practice-guides/telehealth-infants-and-toddlers/types-telehealth-services-infants)

- **Development of an App for Tracking Family Engagement With Early Intervention Services: Focus Groups and Pilot Evaluation Study** (PMC, 2023). Close analog to your product: an app tracking family engagement with early-intervention services, including focus-group-driven design and a pilot evaluation — strong methodological template.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10523211/)

- **Mobile tools can be effective in increasing developmental and mental health screening and referral rates** (Pediatrics/AAP meeting abstract). Direct evidence that mobile tools measurably increase both screening completion and referral follow-through — good supporting citation for your core hypothesis.
  [AAP/Pediatrics](https://publications.aap.org/pediatrics/article/144/2_MeetingAbstract/229/3374/Mobile-tools-can-be-effective-in-increasing)

- **Quality of Mobile Apps for Child Development Support: Search in App Stores and Content Analysis** (JMIR Pediatrics and Parenting, 2022). Content-analysis audit of existing child-development apps on app stores — essentially a competitive landscape scan; important reading before finalizing your feature set.
  [JMIR Pediatrics and Parenting](https://pediatrics.jmir.org/2022/4/e38793)

---

## 7. Ethics and risks of parent-facing screening (important for responsible design)

- **Presymptomatic Screening for Risks to Children's Mental Health** (Journal of Bioethical Inquiry, 2025). Bioethics analysis of screening children for future/emerging risk before symptoms are clear-cut — central to how your app should frame results (risk indicator, not diagnosis) and handle parental anxiety.
  [Springer](https://link.springer.com/article/10.1007/s11673-025-10473-0)

- **Screening is not always healthy: an ethical analysis of health screening packages in Singapore** (BMC Medical Ethics, 2022). General framework for weighing benefits vs. harms (anxiety, false positives, downstream costs) of commercial screening products — directly applicable to a for-profit or app-store screening product.
  [Springer](https://link.springer.com/article/10.1186/s12910-022-00798-5)

- **Parents' Experiences with Online Screening Tools in Well-Child Clinics and School Health Services: A Qualitative Study** (PMC, 2025). Qualitative data on how parents actually experience digital screening tools (trust, anxiety, understanding of results) — valuable for UX and results-communication design.
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12159474/)

- **MisdiagOverdiagUSPSTF Poster** (Boston University, conference poster). Focused specifically on misdiagnosis/overdiagnosis risk in autism screening/USPSTF recommendations — a concise risk-summary worth citing when justifying "refer to professional" rather than "self-diagnose" framing.
  [Boston University](https://sites.bu.edu/asd/files/2019/04/MisdiagOverdiagUSPSTF-Poster-Emily-Hickey.pdf)

---

## How this maps to app development

A few patterns worth calling out for the team:

The strongest precedent for your app's core concept is the NIH/Duke/Princeton "SenseToKnow" line of research (Section 3) — a tablet-front-camera game that captures behavioral signals during short, child-facing tasks and screens for ASD (and now differentiates it from ADHD). It's the closest existing model to "app does the screening, not just a parent questionnaire."

For a lower-engineering-lift MVP, the gamified dyslexia/dyscalculia work (Section 5) and the M-CHAT-R machine-learning abbreviation (Section 3) show that even simplified, short, validated instruments can retain useful accuracy — relevant if you want to launch with parent-report screening before investing in camera/sensor-based assessment.

Section 6 is the evidence base for the "contact a professional" half of the product — particularly the AAP telehealth guidance and the family-engagement tracking app, which is close to a direct precedent.

Section 7 should inform legal/ethical review before launch: screening apps that flag risk without diagnosing need careful UX around how results are worded, and India-specific considerations (referral network availability, language, cost) aren't covered by most of these US/Europe-centric studies — that's a gap worth flagging for original research or local stakeholder interviews.

---

*Note: This is a curated but non-exhaustive survey based on web search of recent (mostly 2022–2026) literature and a few foundational/classic references. Several items are journalistic or agency summaries of the underlying primary research rather than the primary paper itself — where available, both the news summary and the original paper/journal link are included. For a systematic literature review (e.g., for a grant application or academic paper), a formal database search (PubMed, Scopus, Web of Science) with defined inclusion criteria would be needed rather than this web-search-based scan.*
