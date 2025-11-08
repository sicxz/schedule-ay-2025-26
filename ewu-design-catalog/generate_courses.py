#!/usr/bin/env python3
"""Generate complete EWU Design course catalog as markdown files"""

import os
import re

# Course data extracted from catalog
courses = [
    # 100-level
    {
        "code": "DESN-100",
        "name": "Drawing for Communication",
        "credits": 5,
        "level": 100,
        "prereqs": [],
        "track": "foundations",
        "description": "This course covers hand-drawing as a design skill. Emphasis is on sketching, design drawing, design process and composition studies for visual presentation and design solutions. Students gain drawing skills such as basics of drawing techniques, basic shapes, light, texture, pattern, gesture and perspective drawing to communicate and present their ideas visually. Students learn and develop critical thinking and creative problem solving skills using the drawing process.",
        "topics": ["sketching", "design drawing", "composition", "perspective", "critical thinking"]
    },
    # 200-level
    {
        "code": "DESN-200",
        "name": "Visual Thinking + Making",
        "credits": 5,
        "level": 200,
        "prereqs": ["ENGL-101"],
        "track": "foundations",
        "satisfies": "BACR for humanities and arts",
        "description": "Designed to enhance students' creative problem-solving skills through hands-on projects. Encourages students to explore non-linear thinking strategies and engage in the creative production of visual artifacts.",
        "topics": ["creative problem-solving", "non-linear thinking", "visual production"]
    },
    {
        "code": "DESN-210",
        "name": "Design Lab",
        "credits": 2,
        "level": 200,
        "prereqs": [],
        "track": "professional",
        "description": "Applies creative thinking, problem-solving, and technical skills to develop solutions to project-based learning activities.",
        "topics": ["creative thinking", "problem-solving", "project-based learning"]
    },
    {
        "code": "DESN-213",
        "name": "Photoshop",
        "credits": 2,
        "level": 200,
        "prereqs": [],
        "track": "adobe-tools",
        "description": "Provides hands-on learning in Adobe Photoshop fundamentals through self-paced modules. Covers digital image editing, photo manipulation, compositing techniques, and proper file preparation for both print and digital delivery through practical exercises and skill assessments.",
        "topics": ["image editing", "photo manipulation", "compositing", "file preparation"]
    },
    {
        "code": "DESN-214",
        "name": "Illustrator",
        "credits": 2,
        "level": 200,
        "prereqs": [],
        "track": "adobe-tools",
        "description": "Provides hands-on learning in Adobe Illustrator fundamentals through self-paced modules. Explores vector graphics creation, including drawing and transforming objects, working with shapes and paths, applying color and gradients, and preparing files for various outputs. Practical exercises and skill assessments reinforce learning.",
        "topics": ["vector graphics", "drawing tools", "shapes and paths", "color and gradients"]
    },
    {
        "code": "DESN-215",
        "name": "InDesign",
        "credits": 2,
        "level": 200,
        "prereqs": [],
        "track": "adobe-tools",
        "description": "Offers hands-on learning in Adobe InDesign fundamentals through self-paced modules. Covers page layout design, text formatting, working with images and graphics, and preparing documents for print and digital publication. Practical exercises and skill assessments facilitate mastery of these concepts.",
        "topics": ["page layout", "text formatting", "print preparation", "digital publication"]
    },
    {
        "code": "DESN-216",
        "name": "Digital Foundations",
        "credits": 5,
        "level": 200,
        "prereqs": [],
        "track": "foundations",
        "description": "Introduction to media design and digital culture using computer software for the creation and manipulation of images and text, file management, and preparation for print, web, or multimedia uses.",
        "topics": ["media design", "digital culture", "image manipulation", "file management", "print and web prep"]
    },
    {
        "code": "DESN-217",
        "name": "Figma",
        "credits": 2,
        "level": 200,
        "prereqs": [],
        "track": "adobe-tools",
        "description": "Offers hands-on learning in Figma fundamentals through self-paced modules. Explores user interface (UI) and user experience (UX) design principles, including creating wireframes, designing interactive prototypes, and collaborating in real-time. Practical exercises and skill assessments reinforce learning.",
        "topics": ["UI design", "UX principles", "wireframes", "prototypes", "real-time collaboration"]
    },
    {
        "code": "DESN-243",
        "name": "Typography",
        "credits": 5,
        "level": 200,
        "prereqs": ["DESN-100", "DESN-216"],
        "track": "typography-publication",
        "description": "An introductory-level course concentrating on the fundamentals of typography with emphasis on letterforms, typographic syntax, type specification, type as image and the use of type in a variety of communicative purposes.",
        "topics": ["letterforms", "typographic syntax", "type specification", "type as image"]
    },
    {
        "code": "DESN-263",
        "name": "Visual Communication Design",
        "credits": 5,
        "level": 200,
        "prereqs": ["DESN-100", "DESN-216"],
        "track": "foundations",
        "description": "Provides an introduction to Visual Communication Design including the theories, principles, and practices of visual communication, concept development, design process, and design technology.",
        "topics": ["visual communication theory", "design principles", "concept development", "design process"]
    },
    # 300-level
    {
        "code": "DESN-301",
        "name": "Visual Storytelling",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-100"],
        "track": "game-design",
        "description": "This course will introduce the basics of visual development: from visual storytelling to character design. Students will learn how to create a dialogue between pictures and text through the use of design briefs, research, semiotics, and sequential imagery. They will learn about the history of visual storytelling, practice typographic and pictorial design, and be able to apply what they learn to film, animation/motion design, game design, UX experiences and comics/book illustration projects.",
        "topics": ["visual development", "character design", "semiotics", "sequential imagery", "visual storytelling history"]
    },
    {
        "code": "DESN-305",
        "name": "Social Media Design and Management",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "professional",
        "description": "In this course students learn how to design and implement social media campaigns, foster relationships on social platforms, and comprehend analytics in order to assist organizations with their online presence. Through project-based learning, students communicate brand, personality, and story across social platforms while learning design skills, time management skills, and marketing strategy.",
        "topics": ["social media campaigns", "brand communication", "analytics", "marketing strategy", "time management"]
    },
    {
        "code": "DESN-325",
        "name": "Emergent Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "ai-emergent",
        "repeatable": True,
        "description": "This course explores the benefits and risks of new design technologies. Students learn to recognize emergent design technologies and use them to address design problems and explore ways in which new tools reference past paradigms in order to create forward-thinking design solutions. Through hands-on, project-based learning, students investigate the possibilities inherent in new technologies such as AI, AR/VR/ and Computational Design. This course may be repeated.",
        "topics": ["emergent technologies", "AI", "AR/VR", "computational design", "future design trends"]
    },
    {
        "code": "DESN-326",
        "name": "Introduction to Animation",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-200 or DESN-216 or instructor permission"],
        "track": "animation-motion",
        "description": "Explores the principles and techniques related to the moving image, considering both practical and experimental processes and outcomes in the field of animation. Topics include hand-drawn, stop-motion, and key-framing techniques, both in and out of the computer, investigating concepts surrounding visual rhythm, metamorphosis, narrative, and time.",
        "topics": ["animation principles", "hand-drawn animation", "stop-motion", "key-framing", "visual rhythm", "narrative"]
    },
    {
        "code": "DESN-335",
        "name": "Board Game Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["junior standing or instructor permission"],
        "track": "game-design",
        "description": "Students learn how to design physical board games from beginning to end. Students gain an understanding of game mechanics by playing existing games; brainstorm ideas for new games; create and test rough prototypes; and develop a polished, playable final product. Students also learn how to market their games and present them to others.",
        "topics": ["game mechanics", "prototyping", "playtesting", "game marketing", "presentation skills"]
    },
    {
        "code": "DESN-336",
        "name": "3D Animation",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-326"],
        "track": "animation-motion",
        "description": "This course provides an in-depth introduction to the fundamentals of 3D modeling, animation, texturing, lighting, and rendering using Maxon's Cinema 4D software. Through a combination of lectures, hands-on exercises, and creative projects, students gain the knowledge and skills necessary to create 3D graphics and animations for various industries, including film, motion design, and game design.",
        "topics": ["3D modeling", "Cinema 4D", "texturing", "lighting", "rendering", "3D animation"]
    },
    {
        "code": "DESN-338",
        "name": "User Experience Design 1",
        "credits": 5,
        "level": 300,
        "prereqs": [],
        "track": "ux-interaction",
        "description": "Students develop an understanding of user experience design as a field. Supporting theories, such as visual rhetoric, contextual design, information architecture, gestalt, content strategy, and design ethics, are investigated. Students learn foundational UX research methods. Using design software, students build and test interactive digital prototypes for a variety of user interfaces (UIs).",
        "topics": ["UX foundations", "visual rhetoric", "information architecture", "UX research methods", "prototyping", "UI design"]
    },
    {
        "code": "DESN-343",
        "name": "Typography 2",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-243"],
        "track": "typography-publication",
        "description": "Building on the principles and concepts introduced in DESN 243 Typography, this course will review the fundamentals of typography and extend typographic knowledge and skills with emphasis on letterforms, typographic syntax, type specification, and type as image. Projects will include experimental application of type + image to artifacts and multi-page documents.",
        "topics": ["advanced typography", "experimental typography", "type and image", "multi-page layouts"]
    },
    {
        "code": "DESN-345",
        "name": "Digital Game Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-301", "DESN-326"],
        "track": "game-design",
        "description": "Introduces essential game design and development concepts by creating digital games with the Construct 3 engine across various platforms. Explores game design principles, computational thinking, programming basics, user experience, and testing/debugging. Applies knowledge from prior courses, including storytelling, world-building, character design, animation, interactions, and gameplay mechanics. No prior experience in game design or programming is required.",
        "topics": ["game design principles", "Construct 3", "computational thinking", "gameplay mechanics", "testing and debugging"]
    },
    {
        "code": "DESN-348",
        "name": "User Experience Design 2",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-338"],
        "track": "ux-interaction",
        "description": "Students begin designing experiences that go beyond screens, exploring alternate human-computer interactions and supplementary analog deliverables needed by users. Students investigate, share and implement a wide range of UX methods for planning and discovery, research, design, user testing, and project promotion.",
        "topics": ["beyond-screen UX", "human-computer interaction", "UX methods", "user testing", "analog deliverables"]
    },
    {
        "code": "DESN-350",
        "name": "Digital Photography",
        "credits": 5,
        "level": 300,
        "prereqs": ["junior standing or instructor permission"],
        "track": "photography-video",
        "description": "This class will have an experimental and philosophical approach. Students will use digital imaging mediums for effective communication and image design. Working within the medium of digital photography, students will engage in strategies and philosophies of vision, light/shadow, reproduction, editing and presentation.",
        "topics": ["digital photography", "vision and light", "image editing", "presentation strategies", "experimental photography"]
    },
    {
        "code": "DESN-351",
        "name": "Advanced Photography",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-350"],
        "track": "photography-video",
        "description": "This class is an extension of DESN 350 with considerable work in studio lighting, product photography, and post-production workflows. With a focus on multi-point lighting setups with specific lighting patterns, techniques using multiple sources of light, and off-camera strobes and flashes.",
        "topics": ["studio lighting", "product photography", "post-production", "multi-point lighting", "flash photography"]
    },
    {
        "code": "DESN-355",
        "name": "Motion Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-200", "DESN-216"],
        "track": "animation-motion",
        "description": "This course explores the principles of design through motion, with an emphasis on effective use of typography, graphical elements, sound and motion within time and space. Students learn how to import projects, create narrative structures, storyboard, output for various devices and problem solve moving image concerns.",
        "topics": ["motion principles", "kinetic typography", "storyboarding", "sound design", "motion graphics"]
    },
    {
        "code": "DESN-359",
        "name": "Histories of Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["ENGL-201"],
        "track": "foundations",
        "satisfies": "diversity graduation requirement",
        "description": "Focuses on multiple stories and multiple histories within design practice. Emphasis is placed on the context (social/cultural/political/technological) within which themes emerged and designs were created. Student-led research/discussion is focused on expanding the story of design by discovering and sharing those who have been largely left out of the design history books (female/femme, Black, Native American, Latinx, Asian, African, Australian, indigenous peoples, and more).",
        "topics": ["design history", "diverse perspectives", "social context", "student research", "inclusive histories"]
    },
    {
        "code": "DESN-360",
        "name": "Zine and Publication Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-200"],
        "track": "typography-publication",
        "description": "Facilitates the development of personal style and voice, as students design, edit, and create their own 'zines' (reproducible hand-made booklets). Students practice graphic layout, typography, and professional book assembly. Analog production methods and desktop publishing software are used. Student-made zines will be sold at 'Spokane Zine Fest' and other in-person and digital outlets.",
        "topics": ["zine design", "personal voice", "layout design", "analog production", "publication distribution"]
    },
    {
        "code": "DESN-365",
        "name": "Motion Design 2",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-355"],
        "track": "animation-motion",
        "description": "This course continues to build upon the knowledge and tools explored in Motion 1. Focusing more on the theory and practice of motion design, students will use advanced motion techniques to further realize and develop their motion design projects. Students will explore pre-visualization techniques, character driven design, data visualization processes, and apply in-depth problem solving skills to create large scale projects.",
        "topics": ["advanced motion", "pre-visualization", "character animation", "data visualization", "large-scale projects"]
    },
    {
        "code": "DESN-366",
        "name": "Production Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-243", "DESN-263"],
        "track": "professional",
        "description": "This course provides students with theory, knowledge and skill of production design for both print and web application. Students gain conceptual understanding and practical skill in areas including color management, print production, and web graphics.",
        "topics": ["production workflows", "color management", "print production", "web graphics", "cross-media design"]
    },
    {
        "code": "DESN-368",
        "name": "Code + Design 1",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "web-development",
        "description": "Addresses modern interfaces, concepts, processes, and techniques for creating Front-end web designed sites, applications, and experiences. Students use current design-and-code technologies while preparing for future web enabled devices. Sets a foundational understanding of HTML, SVG, CSS, JS, and the web-as-a-platform.",
        "topics": ["HTML", "CSS", "JavaScript", "SVG", "web platform", "responsive design"]
    },
    {
        "code": "DESN-369",
        "name": "Web Development 1",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "web-development",
        "description": "Bridges visual design and web development, teaching foundational web technologies through hands-on practice. Covers HTML for content structure, CSS for styling and animations, and JavaScript for interactivity. Topics include implementing user interfaces, design patterns for code, server-side programming, version control, and automated deployment processes.",
        "topics": ["HTML structure", "CSS styling", "JavaScript interactivity", "version control", "deployment", "design patterns"]
    },
    {
        "code": "DESN-374",
        "name": "AI + Design",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "ai-emergent",
        "description": "Students engage with AI tools and explore multimodal AI applications. Emphasizes the practical implementation of AI outputs in real-world design scenarios across various mediums. Through hands-on projects, students develop adaptable skills for leveraging AI throughout the design process. Covers ethical considerations and fosters a 'do it with me' approach, preparing students to navigate and innovate in the evolving field of AI-assisted design.",
        "topics": ["AI tools", "multimodal AI", "prompt engineering", "AI ethics", "practical implementation", "design process integration"]
    },
    {
        "code": "DESN-375",
        "name": "Digital Video",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-216"],
        "track": "photography-video",
        "description": "This course offers an introduction to digital video techniques. Students will be introduced to production, editing, theory and practical application for the creation of effective visual communication solutions. Emphasis will be on the creative application of concept and design for the moving image and understanding how to integrate textual, graphical and audio elements for the successful communication of messages created for CD, DVD and the Web.",
        "topics": ["video production", "video editing", "visual communication", "multimedia integration", "concept development"]
    },
    {
        "code": "DESN-378",
        "name": "Code + Design 2",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-368"],
        "track": "web-development",
        "description": "Continues exploration of interfaces, concepts, processes, and techniques for creating Front-end web designed sites, applications, and experiences from Code + Design 1. Introduces web programming, JavaScript libraries, and a modern version control process. Establishes an intermediate understanding of HTML, SVG, CSS, JS, and the web-as-a-platform.",
        "topics": ["advanced JavaScript", "JS libraries", "version control", "web programming", "intermediate web development"]
    },
    {
        "code": "DESN-379",
        "name": "Web Development 2",
        "credits": 5,
        "level": 300,
        "prereqs": ["DESN-369"],
        "track": "web-development",
        "description": "Covers HTML templating, CSS/JavaScript frameworks, databases, and REST APIs. includes full-stack development using JavaScript frameworks, component architecture, static site generation, server-side rendering, database design, and API integration. Emphasizes creating dynamic web applications using industry workflows and best practices for performance.",
        "topics": ["templating", "frameworks", "databases", "REST APIs", "full-stack development", "component architecture"]
    },
    {
        "code": "DESN-384",
        "name": "Digital Sound",
        "credits": 5,
        "level": 300,
        "prereqs": ["junior standing or instructor permission"],
        "track": "audio",
        "description": "Provides a foundation in the techniques of sound design, recording, production, and editing for digital media. Students create and record sound files, apply effects, and mix and produce a variety of multimedia audio elements using state-of-the-art digital technology. Applicable uses include websites, games, multimedia products for promotion and learning, entertainment products, and virtual worlds.",
        "topics": ["sound design", "audio recording", "audio production", "mixing", "multimedia audio", "effects processing"]
    },
    {
        "code": "DESN-396",
        "name": "Experimental Course",
        "credits": "1-5",
        "level": 300,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Experimental.",
        "topics": ["variable content", "experimental topics"]
    },
    {
        "code": "DESN-398",
        "name": "Seminar",
        "credits": "1-6",
        "level": 300,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Seminar.",
        "topics": ["variable content", "seminar topics"]
    },
    {
        "code": "DESN-399",
        "name": "Directed Study",
        "credits": "1-10",
        "level": 300,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Directed Study.",
        "topics": ["independent study", "faculty-directed project"]
    },
    # 400-level
    {
        "code": "DESN-401",
        "name": "Imaginary Worlds",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-301"],
        "track": "game-design",
        "description": "Students will research, explore and create pictorial images based on universal ideas of world building. They will examine the cultural context of imagery contained within folklore, legends, myths, fantasy and science fiction, explore how the role of global communities, ethics, satire, wit and the internet impact contemporary image making, and use a variety of media to explore atmosphere, color, character design, and plot visualization in the creation of virtual environments and narratives.",
        "topics": ["world building", "cultural imagery", "character design", "narrative visualization", "virtual environments"]
    },
    {
        "code": "DESN-446",
        "name": "4D Animation",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-336", "DESN-365"],
        "track": "animation-motion",
        "description": "This course focuses on advanced student projects using Animation and Motion Design techniques. Students use skills developed in prior coursework, 3D Animation, Motion Design, etc. to build on and complete larger scale project(s). Continued animation theory, principles, and techniques will be included.",
        "topics": ["advanced animation", "large-scale projects", "animation theory", "portfolio projects"]
    },
    {
        "code": "DESN-458",
        "name": "User Experience Design 3",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-348"],
        "track": "ux-interaction",
        "description": "Students continue to apply the UX design process: research, application, testing and iteration to create useful interactions between designs and end users. Working with community partners, students solve real-world user experience problems. Students learn how to present their work in the UX portfolio format.",
        "topics": ["advanced UX", "community partners", "real-world projects", "portfolio development", "UX process mastery"]
    },
    {
        "code": "DESN-463",
        "name": "Community-Driven Design",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-243", "DESN-263"],
        "track": "professional",
        "description": "How to design for community impact. Students apply research-driven design methodologies to develop messaging, branding, and digital/print materials that serve community partners. Emphasizing typography, composition, and engagement, projects focus on ethical storytelling and collaboration with organizations. By considering stakeholders, policies, and social structures, students design clear, actionable, and sustainable solutions addressing community needs within complex systems.",
        "topics": ["community impact", "ethical design", "stakeholder engagement", "social design", "sustainable solutions"]
    },
    {
        "code": "DESN-468",
        "name": "Code + Design 3",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-378"],
        "track": "web-development",
        "description": "Improves the design and development of front-end web designed sites, applications, and experiences from Code + Design 1 and Code + Design 2. Explores the challenges of designing and developing for the myriad of web-connected devices, physical and digital interfaces, and future design-and-code trends. Establishes an advanced understanding of HTML, SVG, CSS, JS, and the web-as-a-platform.",
        "topics": ["advanced web development", "responsive design", "progressive web apps", "future web trends", "complex interfaces"]
    },
    {
        "code": "DESN-469",
        "name": "Web Development 3",
        "credits": 5,
        "level": 400,
        "prereqs": ["DESN-379"],
        "track": "web-development",
        "description": "Focuses on implementing web applications from design through deployment. Students create full-stack projects using content management systems, interface design patterns, and modern development workflows. Topics include continuous integration/deployment (CI/CD) and multi-platform development. Students complete a portfolio demonstrating mastery of both design principles and technical implementation.",
        "topics": ["full-stack applications", "CMS", "CI/CD", "deployment", "multi-platform", "portfolio development"]
    },
    {
        "code": "DESN-480",
        "name": "Professional Practice",
        "credits": 5,
        "level": 400,
        "prereqs": ["senior standing"],
        "track": "professional",
        "description": "Professional Practice is the study of the visual design industry from both the agency and freelance perspective.",
        "topics": ["agency work", "freelance practice", "design industry", "professional standards", "business practices"]
    },
    {
        "code": "DESN-490",
        "name": "Senior Capstone",
        "credits": 5,
        "level": 400,
        "prereqs": ["senior standing", "DESN-368"],
        "track": "professional",
        "satisfies": "senior capstone requirement",
        "description": "Expands on previous knowledge and skills in visual communication design. Students create a professional portfolio ready for employers while developing a project that fulfills capstone requirements. Students establish connections to the design industry and its professionals while developing a portfolio that showcases their technical skills and design solutions. The course also includes preparing resumes, cover letters, and digital presence for real job openings.",
        "topics": ["portfolio development", "capstone project", "industry connections", "job preparation", "professional presentation"]
    },
    {
        "code": "DESN-491",
        "name": "Senior Project",
        "credits": "1-10",
        "level": 400,
        "prereqs": ["senior standing", "instructor permission"],
        "track": "professional",
        "grading": "Pass/Fail",
        "description": "Independent and/or group study and production of a design project.",
        "topics": ["independent study", "group project", "design production"]
    },
    {
        "code": "DESN-493",
        "name": "Portfolio Practice",
        "credits": 2,
        "level": 400,
        "prereqs": [],
        "track": "professional",
        "repeatable": True,
        "description": "This course is the last in a three course portfolio sequence that provides a scaffolded approach to student portfolio development. Students continue to develop career-ready portfolios and apply for jobs and internships. Students share portfolios in a showcase event spring quarter. This course may be repeated.",
        "topics": ["portfolio refinement", "job applications", "internship applications", "portfolio showcase"]
    },
    {
        "code": "DESN-495",
        "name": "Internship",
        "credits": "2-15",
        "level": 400,
        "prereqs": ["junior standing", "instructor/chair/dean permission"],
        "track": "professional",
        "grading": "Pass/Fail",
        "description": "An internship is on-the-job-training. It exposes students to the professional environment through outside job opportunities in graphic design studios, advertising agencies, corporate communications departments and other acceptable organizations. Students work under the guidance of art directors, creative directors, senior graphic designers or marketing managers and perform creative work that is educational and meaningful for their their long-range career preparation.",
        "topics": ["on-the-job training", "professional experience", "industry mentorship", "applied design work"]
    },
    {
        "code": "DESN-496",
        "name": "Experimental",
        "credits": "1-6",
        "level": 400,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Experimental.",
        "topics": ["variable content", "experimental topics"]
    },
    {
        "code": "DESN-497",
        "name": "Workshop, Short Course, Conference, Seminar",
        "credits": "1-6",
        "level": 400,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Workshop.",
        "topics": ["workshop content", "professional development", "conference participation"]
    },
    {
        "code": "DESN-498",
        "name": "Seminar",
        "credits": "1-6",
        "level": 400,
        "prereqs": [],
        "track": "special",
        "repeatable": True,
        "description": "Seminar.",
        "topics": ["seminar topics", "advanced discussion"]
    },
    {
        "code": "DESN-499",
        "name": "Directed Study",
        "credits": "1-6",
        "level": 400,
        "prereqs": ["instructor/chair/dean permission"],
        "track": "special",
        "repeatable": True,
        "description": "Directed Study.",
        "topics": ["independent study", "faculty-directed research"]
    }
]

def generate_course_file(course):
    """Generate markdown file content for a course"""
    
    # Handle variable credits
    credits_str = str(course['credits'])
    
    # Build frontmatter
    frontmatter = f"""---
course_code: {course['code']}
course_name: {course['name']}
credits: {credits_str}
level: {course['level']}
prerequisites: {course.get('prereqs', [])}
track: {course['track']}
topics:
"""
    
    for topic in course.get('topics', []):
        frontmatter += f"  - {topic}\n"
    
    if 'satisfies' in course:
        frontmatter += f"satisfies: {course['satisfies']}\n"
    
    if 'grading' in course:
        frontmatter += f"grading: {course['grading']}\n"
    
    if course.get('repeatable', False):
        frontmatter += "repeatable: true\n"
    
    frontmatter += "---\n\n"
    
    # Build main content
    content = f"# {course['code']}: {course['name']}\n\n"
    content += f"## Catalog Description\n\n{course['description']}\n\n"
    
    # Prerequisites section
    content += "## Prerequisites\n\n"
    if course.get('prereqs'):
        if isinstance(course['prereqs'], list):
            for prereq in course['prereqs']:
                content += f"- {prereq}\n"
        else:
            content += f"{course['prereqs']}\n"
    else:
        content += "None\n"
    
    content += "\n"
    
    # Topics section
    if course.get('topics'):
        content += "## Key Topics\n\n"
        for topic in course['topics']:
            content += f"- {topic.title()}\n"
        content += "\n"
    
    return frontmatter + content

# Generate all files
base_path = "/home/claude/ewu-design-catalog/courses"

for course in courses:
    level = course['level']
    level_dir = f"{base_path}/{level}-level"
    
    # Ensure directory exists
    os.makedirs(level_dir, exist_ok=True)
    
    # Generate file
    filename = f"{level_dir}/{course['code']}.md"
    content = generate_course_file(course)
    
    with open(filename, 'w') as f:
        f.write(content)
    
    print(f"Created: {course['code']}")

print(f"\n✓ Generated {len(courses)} course files")
