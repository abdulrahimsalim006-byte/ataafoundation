
const SUPABASE_URL = "https://otnwogrldpttupipudrm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-NOZ7_Qy-afhSXUemTbnsw_ngUEUaZF";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const projectsGrid = document.getElementById("projects-grid");
const projectsMessage = document.getElementById("projects-message");

function formatMoney(amount) {
    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}

function showMessage(message, isError = false) {
    projectsMessage.textContent = message;
    projectsMessage.classList.toggle("error", isError);
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = text;
    }

    return element;
}

function renderProject(project, totalRaised) {
    const target = Math.max(Number(project.target_budget) || 0, 0);
    const raised = Math.max(Number(totalRaised) || 0, 0);
    const remaining = Math.max(target - raised, 0);

    const percentage = target > 0
        ? Math.min((raised / target) * 100, 100)
        : 0;

    const card = createElement("article", "project-card");

    if (project.cover_image_url) {
        const image = createElement("img", "project-image");
        image.src = project.cover_image_url;
        image.alt = project.title || "Ataa Foundation project";
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.remove();
        });

        card.appendChild(image);
    }

    const content = createElement("div", "project-card-content");

    const status = createElement(
        "span",
        "project-status",
        String(project.status || "ongoing").replaceAll("_", " ")
    );

    const title = createElement("h3", "", project.title || "Untitled project");

    content.append(status, title);

    if (project.location) {
        content.appendChild(
            createElement("p", "project-location", "⌖ " + project.location)
        );
    }

    if (project.description) {
        content.appendChild(
            createElement("p", "project-description", project.description)
        );
    }

    const funding = createElement("div", "project-funding");

    const fundingLabel = createElement("div", "project-funding-label");
    fundingLabel.append(
        createElement("span", "", "Fundraising progress"),
        createElement("strong", "", `${percentage.toFixed(0)}%`)
    );

    const track = createElement("div", "project-progress-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `Funds raised for ${project.title}`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.round(percentage)));

    const fill = createElement("div", "project-progress-fill");
    fill.style.width = `${percentage}%`;
    track.appendChild(fill);

    const finance = createElement("div", "project-finance-details");

    const raisedBox = document.createElement("div");
    raisedBox.append(
        createElement("span", "", "Raised"),
        createElement("strong", "", formatMoney(raised))
    );

    const targetBox = document.createElement("div");
    targetBox.append(
        createElement("span", "", "Target"),
        createElement("strong", "", formatMoney(target))
    );

    finance.append(raisedBox, targetBox);

    const remainingText = createElement(
        "p",
        "project-location",
        `Remaining: ${formatMoney(remaining)}`
    );

    const donateLink = createElement(
        "a",
        "project-donate-button",
        "Support This Project"
    );

    donateLink.href = `donate.html?project=${encodeURIComponent(project.id)}`;

    funding.append(fundingLabel, track, finance, remainingText, donateLink);
    content.appendChild(funding);
    card.appendChild(content);

    return card;
}

async function loadProjects() {
    showMessage("Loading projects...");

    try {
        const { data: projects, error: projectsError } = await db
            .from("projects")
            .select(
                "id, title, slug, description, category, location, target_budget, cover_image_url, status, deadline"
            )
            .eq("is_published", true)
            .order("created_at", { ascending: false });

        if (projectsError) {
            throw projectsError;
        }

        if (!projects || projects.length === 0) {
            projectsGrid.replaceChildren();
            showMessage(
                "Our projects will appear here once they have been published. Please check back soon."
            );
            return;
        }

        const { data: totals, error: totalsError } = await db.rpc(
            "get_public_project_totals"
        );

        if (totalsError) {
            throw totalsError;
        }

        const totalsByProject = new Map(
            (totals || []).map(item => [
                item.project_id,
                Number(item.total_raised) || 0
            ])
        );

        const cards = projects.map(project =>
            renderProject(
                project,
                totalsByProject.get(project.id) || 0
            )
        );

        projectsGrid.replaceChildren(...cards);
        showMessage("");
    } catch (error) {
        console.error("Could not load Ataa projects:", error);

        projectsGrid.replaceChildren();
        showMessage(
            "We couldn't load the projects right now. Please try again later.",
            true
        );
    }
}

loadProjects();
