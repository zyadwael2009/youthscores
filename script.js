// API URLs
const CONFIG_URL = 'https://youth-scores-data.vercel.app/api/config';

// Global data storage
let mainData = null;
let allMatches = [];

// Helper function to show modal as popup
function showModal(modal) {
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '9999';
    modal.style.overflow = 'auto';
    document.body.style.overflow = 'hidden'; // Prevent body scroll
}

// Helper function to hide modal
function hideModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore body scroll
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Hide all modals on page load
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        await loadMainData();
        
        // Only run functions if their containers exist on the current page
        if (document.getElementById('today-matches-container')) {
            await loadRandomMatchesForHome();
        }
        if (document.getElementById('home-news-container')) {
            displayHomeNews();
        }
        if (document.getElementById('seasons-container')) {
            displayCompetitions();
        }
        if (document.getElementById('news-container')) {
            displayNews();
        }
        if (document.getElementById('venues-container')) {
            displayVenues();
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Toggle collapsible sections
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const header = section.previousElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    section.classList.toggle('active');
    icon.classList.toggle('rotated');
}

// Load main data from dynamic config URL (API only)
async function loadMainData() {
    const container = document.getElementById('today-matches-container');
    
    try {
        // Step 1: Fetch config to get latest data URL
        console.log('Fetching config from:', CONFIG_URL);
        const configResponse = await fetch(CONFIG_URL, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!configResponse.ok) {
            const errorText = await configResponse.text();
            console.error('Config API error response:', errorText);
            throw new Error(`Config API returned status: ${configResponse.status}. Response: ${errorText.substring(0, 100)}`);
        }
        
        const config = await configResponse.json();
        console.log('Config received:', config);
        
        const dataUrl = config.latestDataUrl;
        
        if (!dataUrl) {
            throw new Error('No latestDataUrl found in config');
        }
        
        console.log('Latest data URL from config:', dataUrl);
        
        // Step 2: Fetch actual data from the URL
        console.log('Fetching data from:', dataUrl);
        const response = await fetch(dataUrl);
        
        if (!response.ok) {
            throw new Error(`Data fetch failed with status: ${response.status}`);
        }
        
        mainData = await response.json();
        console.log('Main data loaded successfully. Seasons:', mainData.seasons?.length || 0);
        
        if (!mainData.seasons || mainData.seasons.length === 0) {
            throw new Error('No seasons found in data');
        }
    } catch (error) {
        console.error('Error loading main data:', error);
        
        // Show detailed error only if container exists
        if (container) {
            if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
                container.innerHTML = `
                    <div class="no-data" style="text-align: center; padding: 20px;">
                        <h3 style="color: #7e0000; margin-bottom: 15px;">❌ خطأ في CORS</h3>
                        <p>يجب إضافة CORS headers إلى API في Vercel</p>
                    </div>
                `;
            } else if (error.message.includes('500')) {
                container.innerHTML = `
                    <div class="no-data" style="text-align: center; padding: 20px;">
                        <h3 style="color: #7e0000; margin-bottom: 15px;">❌ خطأ في الخادم (500)</h3>
                        <p>يوجد خطأ في API على Vercel. يرجى التحقق من:</p>
                        <ul style="text-align: right; display: inline-block; margin: 15px 0;">
                            <li>أن CORS headers صحيحة</li>
                            <li>أن الكود في API يعمل بدون أخطاء</li>
                            <li>سجلات Vercel للحصول على تفاصيل الخطأ</li>
                        </ul>
                        <p style="color: #666; font-size: 14px; margin-top: 15px;">راجع Console للحصول على المزيد من التفاصيل</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="no-data" style="text-align: center; padding: 20px;">
                        <h3 style="color: #7e0000;">فشل تحميل البيانات</h3>
                        <p style="color: #666; margin-top: 10px;">${error.message}</p>
                    </div>
                `;
            }
        }
        throw error;
    }
}

// Load matches from one random competition for home page
async function loadRandomMatchesForHome() {
    const container = document.getElementById('today-matches-container');
    
    if (!mainData || !mainData.seasons) {
        console.error('No main data available');
        container.innerHTML = '<div class="no-data">لا توجد بيانات متاحة</div>';
        return;
    }

    // Collect all possible match URLs
    const allUrls = [];
    
    for (const season of mainData.seasons) {
        for (const competition of season.competitions) {
            if (competition.ages) {
                for (const ageGroup of competition.ages) {
                    if (ageGroup.matchesurl) {
                        const urls = Array.isArray(ageGroup.matchesurl) 
                            ? ageGroup.matchesurl 
                            : [ageGroup.matchesurl];
                        
                        urls.forEach(url => {
                            allUrls.push({
                                url: url,
                                competition: competition.name.ar,
                                age: ageGroup.age,
                                season: season.season
                            });
                        });
                    }
                }
            }
        }
    }

    console.log(`Found ${allUrls.length} match URLs`);

    if (allUrls.length === 0) {
        console.error('No match URLs found');
        container.innerHTML = '<div class="no-data">لا توجد روابط مباريات متاحة</div>';
        return;
    }

    // Get current day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const today = new Date().getDay();
    
    // Determine which age groups to load based on day
    let targetAges = [];
    let targetCompetition = null;
    
    switch(today) {
        case 6: // Saturday
            targetAges = ['2009', '2010'];
            break;
        case 5: // Friday
            targetAges = ['2011'];
            break;
        case 1: // Monday
            targetAges = ['2007', '2008'];
            break;
        case 0: // Sunday
            targetAges = ['2005'];
            break;
        case 4: // Thursday
            targetAges = ['2005'];
            targetCompetition = 'دوري الجمهورية القسم الثاني ب';
            break;
        case 3: // Wednesday
            targetAges = ['2007'];
            targetCompetition = 'دوري الجمهورية القسم الثاني ب';
            break;
        case 2: // Tuesday
            targetAges = ['2009'];
            break;
        default:
            targetAges = [];
    }

    console.log(`Day: ${today}, Target ages: ${targetAges}, Target competition: ${targetCompetition}`);

    // Filter URLs based on day
    const matchingUrls = allUrls.filter(urlData => {
        if (!targetAges.includes(urlData.age)) return false;
        if (targetCompetition && urlData.competition !== targetCompetition) return false;
        return true;
    });

    console.log(`Found ${matchingUrls.length} matching URLs for today`);

    if (matchingUrls.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات اليوم</div>';
        return;
    }

    // Try to load matches from matching URLs
    allMatches = [];
    
    for (const urlData of matchingUrls) {
        try {
            console.log(`Loading from: ${urlData.url}`);
            const response = await fetch(urlData.url);
            
            if (!response.ok) {
                console.log(`Failed to load ${urlData.url}`);
                continue;
            }
            
            const data = await response.json();
            
            if (data.matches && Array.isArray(data.matches)) {
                // Add competition/age info to each match
                data.matches.forEach(match => {
                    match.competition = urlData.competition;
                    match.age = urlData.age;
                    match.season = urlData.season;
                    match.teams = data.teams;
                });
                
                allMatches.push(...data.matches);
                console.log(`Loaded ${data.matches.length} matches from ${urlData.age}`);
            }
            
            // Stop loading if we have enough matches
            if (allMatches.length >= 4) {
                break;
            }
        } catch (error) {
            console.error(`Error loading ${urlData.url}:`, error);
        }
    }
    
    if (allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات اليوم</div>';
        return;
    }
    
    // Filter matches to only show those scheduled for today
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const todayMatches = allMatches.filter(match => {
        if (!match.date) return false;
        const matchDate = new Date(match.date);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate.getTime() === todayDate.getTime();
    });
    
    if (todayMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات اليوم</div>';
        return;
    }
    
    // Update allMatches with filtered results
    allMatches = todayMatches;
    
    console.log(`Total matches for today: ${allMatches.length}`);
    displayTodayMatches();
}

// Display matches on home page (just show first 4 from loaded matches)
function displayTodayMatches() {
    const container = document.getElementById('today-matches-container');
    
    if (!container) {
        console.log('today-matches-container not found on this page');
        return;
    }
    
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات متاحة حالياً</div>';
        return;
    }

    console.log(`Displaying ${Math.min(4, allMatches.length)} matches`);

    // Get competition info from first match
    const firstMatch = allMatches[0];
    const competitionHeader = firstMatch.competition ? `
        <div class="today-matches-competition-header">
            <span class="competition-name">${firstMatch.competition}</span>
            ${firstMatch.age ? `<span class="competition-age">${firstMatch.age}</span>` : ''}
        </div>
    ` : '';

    // Display only first 4 matches with details
    container.innerHTML = competitionHeader + '<div class="matches-grid"></div>';
    const grid = container.querySelector('.matches-grid');
    
    const matchesToShow = allMatches.slice(0, 4);
    matchesToShow.forEach(match => {
        const card = createMatchCard(match, true);
        grid.appendChild(card);
    });
}

// Create a match card element
function createMatchCard(match, showDetails = false) {
    const card = document.createElement('div');
    card.className = 'match-card';
    
    // Try different possible property names for team IDs
    const homeTeamId = match.home_team_id || match.homeTeamId || match.homeTeam || match.home;
    const awayTeamId = match.away_team_id || match.awayTeamId || match.awayTeam || match.away;
    
    // Get scores - for completed matches only
    let homeScore = '-';
    let awayScore = '-';
    
    console.log('Match data:', {
        status: match.status,
        home_score: match.home_score,
        away_score: match.away_score,
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId
    });
    
    if (match.status === 'completed' || match.status === 'finished') {
        homeScore = match.home_score !== undefined && match.home_score !== null ? match.home_score : '-';
        awayScore = match.away_score !== undefined && match.away_score !== null ? match.away_score : '-';
        console.log('Completed match - scores set to:', homeScore, awayScore);
    }
    
    const homeTeamInfo = getTeamInfo(match, homeTeamId);
    const awayTeamInfo = getTeamInfo(match, awayTeamId);
    
    const status = getMatchStatus(match);
    const venue = getVenueName(match.venueId);
    const matchTime = match.time || match.matchTime || 'غير محدد';
    
    console.log('Final status:', status, 'Final scores:', homeScore, awayScore);
    
    // Build scorers HTML if match details should be shown
    let scorersHTML = '';
    if (showDetails && match.scorers && match.scorers.length > 0) {
        scorersHTML = `
            <div class="scorers-list-inline">
                <h4 style="color: #7e0000; font-size: 1em; margin: 15px 0 10px;">⚽ الهدافون:</h4>
                ${match.scorers.map(scorer => `
                    <div class="scorer-item-inline">
                        <span class="scorer-name">${scorer.playerName}</span>
                        ${scorer.time ? `<span class="scorer-time">(${scorer.time})</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Determine what to show in the middle (VS or score/time)
    let middleContent = '';
    if (status.class === 'status-finished') {
        // Finished: Show logos and scores in the middle
        console.log(`Rendering finished match: ${homeTeamInfo.name} ${homeScore} - ${awayScore} ${awayTeamInfo.name}`);
        middleContent = `
            <div class="match-teams-with-logos">
                <div class="team-side">
                    ${homeTeamInfo.logo ? `<img src="${homeTeamInfo.logo}" alt="${homeTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${homeTeamInfo.name}</div>
                </div>
                <div class="match-center">
                    <div class="score-display">${homeScore} - ${awayScore}</div>
                </div>
                <div class="team-side">
                    ${awayTeamInfo.logo ? `<img src="${awayTeamInfo.logo}" alt="${awayTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${awayTeamInfo.name}</div>
                </div>
            </div>
        `;
    } else if (status.class === 'status-delayed') {
        // Delayed: Show logos and "تأجلت" text
        middleContent = `
            <div class="match-teams-with-logos">
                <div class="team-side">
                    ${homeTeamInfo.logo ? `<img src="${homeTeamInfo.logo}" alt="${homeTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${homeTeamInfo.name}</div>
                </div>
                <div class="match-center">
                    <div class="match-time-display" style="background: rgba(126, 0, 0, 0.15);">تأجلت</div>
                </div>
                <div class="team-side">
                    ${awayTeamInfo.logo ? `<img src="${awayTeamInfo.logo}" alt="${awayTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${awayTeamInfo.name}</div>
                </div>
            </div>
        `;
    } else if (status.class === 'status-upcoming') {
        // Upcoming: Show logos and time
        middleContent = `
            <div class="match-teams-with-logos">
                <div class="team-side">
                    ${homeTeamInfo.logo ? `<img src="${homeTeamInfo.logo}" alt="${homeTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${homeTeamInfo.name}</div>
                </div>
                <div class="match-center">
                    <div class="match-time-display">${matchTime}</div>
                </div>
                <div class="team-side">
                    ${awayTeamInfo.logo ? `<img src="${awayTeamInfo.logo}" alt="${awayTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${awayTeamInfo.name}</div>
                </div>
            </div>
        `;
    } else {
        // Live: Show logos and scores with VS
        middleContent = `
            <div class="match-teams-with-logos">
                <div class="team-side">
                    ${homeTeamInfo.logo ? `<img src="${homeTeamInfo.logo}" alt="${homeTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${homeTeamInfo.name}</div>
                </div>
                <div class="match-center">
                    <div class="score-display">${homeScore} VS ${awayScore}</div>
                </div>
                <div class="team-side">
                    ${awayTeamInfo.logo ? `<img src="${awayTeamInfo.logo}" alt="${awayTeamInfo.name}" class="team-logo">` : ''}
                    <div class="team-name">${awayTeamInfo.name}</div>
                </div>
            </div>
        `;
    }
    
    console.log('middleContent HTML:', middleContent);
    
    // Show note/venue below score for completed/upcoming matches
    let belowScoreInfo = '';
    if (status.class === 'status-finished' && match.note) {
        belowScoreInfo = `<div class="match-below-score">${match.note}</div>`;
    } else if (status.class === 'status-upcoming' && match.venue) {
        belowScoreInfo = `<div class="match-below-score">${match.venue}</div>`;
    }
    
    // Only show status badge for delayed and live matches
    let statusBadge = '';
    if (status.class === 'status-delayed' || status.class === 'status-live') {
        statusBadge = `<div class="match-status ${status.class}">${status.text}</div>`;
    }
    
    card.innerHTML = `
        ${middleContent}
        ${belowScoreInfo}
        ${statusBadge}
        ${scorersHTML}
    `;
    
    console.log('Final card HTML:', card.innerHTML);
    
    // Always make card clickable
    card.onclick = () => showMatchDetails(match);
    card.style.cursor = 'pointer';
    
    return card;
}

// Get team info (name and logo) by ID
function getTeamInfo(match, teamId) {
    if (!match.teams || !teamId) {
        return { name: 'فريق غير معروف', logo: null, group: null };
    }
    
    const team = match.teams.find(t => 
        t.teamId === teamId || 
        t.id === teamId || 
        t.team_id === teamId
    );
    
    if (!team) {
        return { name: 'فريق غير معروف', logo: null, group: null };
    }
    
    return {
        name: team.name || team.teamName || team.team_name || 'فريق غير معروف',
        logo: team.logo || null,
        group: team.group || null
    };
}

// Get team name by ID (for backwards compatibility)
function getTeamName(match, teamId) {
    return getTeamInfo(match, teamId).name;
}

// Get match status
function getMatchStatus(match) {
    // Check status field first (most reliable)
    if (match.status === 'completed' || match.status === 'finished') {
        // Show note if available, otherwise show "انتهت"
        const statusText = match.note || 'انتهت';
        return { text: statusText, class: 'status-finished' };
    }
    
    if (match.status === 'delayed' || match.status === 'postponed') {
        return { text: 'تأجلت', class: 'status-delayed' };
    }
    
    if (match.status === 'upcoming' || match.status === 'scheduled') {
        // Show venue if available, otherwise show "لم تبدأ"
        const statusText = match.venue || 'لم تبدأ';
        return { text: statusText, class: 'status-upcoming' };
    }
    
    if (match.status === 'live' || match.status === 'in_progress') {
        return { text: 'جارية', class: 'status-live' };
    }
    
    // Fallback: check date if status is not set
    const matchDateTime = new Date(match.date || match.matchDate);
    const now = new Date();
    
    if (matchDateTime < now) {
        return { text: 'انتهت', class: 'status-finished' };
    }
    
    return { text: 'لم تبدأ', class: 'status-upcoming' };
}

// Get venue name by ID
function getVenueName(venueId) {
    if (!mainData || !mainData.venues || !venueId) return null;
    const venue = mainData.venues.find(v => v.venue_id === venueId);
    return venue ? venue.name : null;
}

// Format date in Arabic
function formatArabicDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'تاريخ غير محدد';
    }
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('ar-EG', options);
}

// Show match details in modal
function showMatchDetails(match) {
    const modal = document.getElementById('match-modal');
    const detailsContainer = document.getElementById('match-details');
    
    const homeTeamInfo = getTeamInfo(match, match.homeTeamId || match.home_team_id);
    const awayTeamInfo = getTeamInfo(match, match.awayTeamId || match.away_team_id);
    const homeScore = match.home_score !== undefined ? match.home_score : '-';
    const awayScore = match.away_score !== undefined ? match.away_score : '-';
    
    // Helper function to parse scorers and assists
    function parseScorersAndAssists(scorersList) {
        if (!scorersList || scorersList.length === 0) return { goals: [], assists: [] };
        
        const assistMarker = 'صناعة الاهداف';
        const assistIndex = scorersList.findIndex(item => item === assistMarker);
        
        if (assistIndex === -1) {
            // No assists marker found, all are goals
            return { goals: scorersList, assists: [] };
        }
        
        // Split: before marker = goals, after marker = assists
        return {
            goals: scorersList.slice(0, assistIndex),
            assists: scorersList.slice(assistIndex + 1)
        };
    }
    
    const homeData = parseScorersAndAssists(match.home_scorers);
    const awayData = parseScorersAndAssists(match.away_scorers);
    
    // Build home team details
    let homeDetailsHTML = '';
    if (homeData.goals.length > 0 || homeData.assists.length > 0 || 
        (match.home_yc && match.home_yc.length > 0) || (match.home_rc && match.home_rc.length > 0)) {
        homeDetailsHTML = '<div class="modal-team-details">';
        
        if (homeData.goals.length > 0) {
            homeDetailsHTML += `
                <div class="detail-section">
                    <h4>⚽ الأهداف</h4>
                    <div class="detail-list">
                        ${homeData.goals.map(scorer => `<div class="detail-item">${scorer}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (homeData.assists.length > 0) {
            homeDetailsHTML += `
                <div class="detail-section">
                    <h4>🎯 صناعة الأهداف</h4>
                    <div class="detail-list">
                        ${homeData.assists.map(assister => `<div class="detail-item">${assister}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (match.home_yc && match.home_yc.length > 0) {
            homeDetailsHTML += `
                <div class="detail-section">
                    <h4>🟨 الإنذارات</h4>
                    <div class="detail-list">
                        ${match.home_yc.map(player => `<div class="detail-item">${player}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (match.home_rc && match.home_rc.length > 0) {
            homeDetailsHTML += `
                <div class="detail-section">
                    <h4>🟥 الطرد</h4>
                    <div class="detail-list">
                        ${match.home_rc.map(player => `<div class="detail-item">${player}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        homeDetailsHTML += '</div>';
    }
    
    // Build away team details
    let awayDetailsHTML = '';
    if (awayData.goals.length > 0 || awayData.assists.length > 0 || 
        (match.away_yc && match.away_yc.length > 0) || (match.away_rc && match.away_rc.length > 0)) {
        awayDetailsHTML = '<div class="modal-team-details">';
        
        if (awayData.goals.length > 0) {
            awayDetailsHTML += `
                <div class="detail-section">
                    <h4>⚽ الأهداف</h4>
                    <div class="detail-list">
                        ${awayData.goals.map(scorer => `<div class="detail-item">${scorer}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (awayData.assists.length > 0) {
            awayDetailsHTML += `
                <div class="detail-section">
                    <h4>🎯 صناعة الأهداف</h4>
                    <div class="detail-list">
                        ${awayData.assists.map(assister => `<div class="detail-item">${assister}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (match.away_yc && match.away_yc.length > 0) {
            awayDetailsHTML += `
                <div class="detail-section">
                    <h4>🟨 الإنذارات</h4>
                    <div class="detail-list">
                        ${match.away_yc.map(player => `<div class="detail-item">${player}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (match.away_rc && match.away_rc.length > 0) {
            awayDetailsHTML += `
                <div class="detail-section">
                    <h4>🟥 الطرد</h4>
                    <div class="detail-list">
                        ${match.away_rc.map(player => `<div class="detail-item">${player}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        awayDetailsHTML += '</div>';
    }
    
    detailsContainer.innerHTML = `
        <div class="modal-header">
            <h2>${match.competition || 'مباراة'} - ${match.age || ''}</h2>
            ${match.group ? `<div class="modal-group">المجموعة ${match.group}</div>` : ''}
            ${match.week ? `<div class="modal-week">الأسبوع ${match.week}</div>` : ''}
        </div>
        
        <div class="modal-match-display">
            <div class="modal-team">
                ${homeTeamInfo.logo ? `<img src="${homeTeamInfo.logo}" alt="${homeTeamInfo.name}" class="modal-team-logo">` : ''}
                <div class="modal-team-name">${homeTeamInfo.name}</div>
            </div>
            <div class="modal-score">
                <div class="modal-score-numbers">${homeScore} - ${awayScore}</div>
                ${match.status === 'upcoming' || match.status === 'scheduled' ? `<div class="modal-match-time">${match.time || 'غير محدد'}</div>` : ''}
            </div>
            <div class="modal-team">
                ${awayTeamInfo.logo ? `<img src="${awayTeamInfo.logo}" alt="${awayTeamInfo.name}" class="modal-team-logo">` : ''}
                <div class="modal-team-name">${awayTeamInfo.name}</div>
            </div>
        </div>
        
        <div class="modal-info">
            <div class="modal-info-item">
                <span class="modal-info-label">📅 التاريخ:</span>
                <span class="modal-info-value">${formatArabicDate(new Date(match.date))}</span>
            </div>
            ${match.venue ? `
                <div class="modal-info-item">
                    <span class="modal-info-label">📍 الملعب:</span>
                    <span class="modal-info-value">${match.venue}</span>
                </div>
            ` : ''}
            ${match.note ? `
                <div class="modal-info-item">
                    <span class="modal-info-label">📝 ملاحظة:</span>
                    <span class="modal-info-value">${match.note}</span>
                </div>
            ` : ''}
        </div>
        
        ${homeDetailsHTML || awayDetailsHTML ? `
            <div class="modal-details-container">
                <div class="modal-details-half">${homeDetailsHTML}</div>
                <div class="modal-details-half">${awayDetailsHTML}</div>
            </div>
        ` : ''}
    `;
    
    showModal(modal);
}

// Close modal
function closeModal() {
    const modal = document.getElementById('match-modal');
    hideModal(modal);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('match-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Display competitions
function displayCompetitions() {
    const container = document.getElementById('seasons-container');
    const selectorContainer = document.getElementById('season-selector');
    
    if (!mainData || !mainData.seasons) {
        container.innerHTML = '<div class="no-data">لا توجد بطولات متاحة</div>';
        return;
    }
    
    // Create season selector
    selectorContainer.innerHTML = '<h3>المواسم</h3>';
    mainData.seasons.forEach((season, index) => {
        const btn = document.createElement('button');
        btn.className = 'season-btn' + (index === 0 ? ' active' : '');
        btn.textContent = season.season;
        btn.onclick = () => showSeasonCompetitions(season.season);
        selectorContainer.appendChild(btn);
    });
    
    // Show first season by default
    showSeasonCompetitions(mainData.seasons[0].season);
}

// Show competitions for a specific season
function showSeasonCompetitions(seasonName) {
    const container = document.getElementById('seasons-container');
    const season = mainData.seasons.find(s => s.season === seasonName);
    
    if (!season) return;
    
    // Update active button
    document.querySelectorAll('.season-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === seasonName) {
            btn.classList.add('active');
        }
    });
    
    // Display competitions with click functionality
    const seasonSection = document.createElement('div');
    seasonSection.className = 'season-section';
    
    let competitionsHTML = '';
    season.competitions.forEach(competition => {
        let agesHTML = '';
        if (competition.ages && competition.ages.length > 0) {
            agesHTML = `
                <div class="age-groups">
                    ${competition.ages.map(age => `
                        <span class="age-badge">مواليد ${age.age}</span>
                    `).join('')}
                </div>
            `;
        }
        
        const competitionIndex = season.competitions.indexOf(competition);
        competitionsHTML += `
            <div class="competition-item" onclick="showAgeSelectionModal('${seasonName}', ${competitionIndex})" style="cursor: pointer;">
                <h4>${competition.name.ar}</h4>
                ${agesHTML}
            </div>
        `;
    });
    
    seasonSection.innerHTML = `
        <h3 class="season-title">🏆 موسم ${season.season}</h3>
        ${competitionsHTML}
    `;
    
    container.innerHTML = '';
    container.appendChild(seasonSection);
}

// Display news
function displayNews() {
    const container = document.getElementById('news-container');
    
    if (!mainData || !mainData.news || mainData.news.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد أخبار متاحة</div>';
        return;
    }
    
    container.innerHTML = '<div class="news-grid"></div>';
    const grid = container.querySelector('.news-grid');
    
    // Sort news by date (newest first)
    const sortedNews = [...mainData.news].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    sortedNews.forEach(newsItem => {
        const card = document.createElement('div');
        card.className = 'news-card';
        
        let contentHTML = '';
        
        // Only add image if it exists and is not null/empty
        if (newsItem.image && newsItem.image.trim() !== '') {
            contentHTML += `
                <div class="news-image-container" onclick="openImageModal('${newsItem.image}')">
                    <img src="${newsItem.image}" class="news-image" alt="${newsItem.title || 'خبر'}">
                </div>
            `;
        }
        
        contentHTML += '<div class="news-content">';
        
        // Only add date if it exists
        if (newsItem.date) {
            contentHTML += `<div class="news-date">📅 ${formatArabicDate(new Date(newsItem.date))}</div>`;
        }
        
        // Only add title if it exists
        if (newsItem.title) {
            contentHTML += `<h3 class="news-title">${newsItem.title}</h3>`;
        }
        
        // Only add details if they exist
        if (newsItem.details) {
            contentHTML += `<div class="news-details">${newsItem.details}</div>`;
        }
        
        contentHTML += '</div>';
        
        card.innerHTML = contentHTML;
        grid.appendChild(card);
    });
}

// Display latest news on home page (limit to 3)
function displayHomeNews() {
    const container = document.getElementById('home-news-container');
    
    if (!mainData || !mainData.news || mainData.news.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد أخبار متاحة</div>';
        return;
    }
    
    container.innerHTML = '';
    
    // Sort news by date (newest first) and take only 1
    const latestNews = [...mainData.news]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 1);
    
    latestNews.forEach(newsItem => {
        const card = document.createElement('div');
        card.className = 'news-card';
        
        let contentHTML = '';
        
        // Only add image if it exists and is not null/empty
        if (newsItem.image && newsItem.image.trim() !== '') {
            contentHTML += `
                <div class="news-image-container" onclick="openImageModal('${newsItem.image}')">
                    <img src="${newsItem.image}" class="news-image" alt="${newsItem.title || 'خبر'}">
                </div>
            `;
        }
        
        contentHTML += '<div class="news-content">';
        
        // Only add date if it exists
        if (newsItem.date) {
            contentHTML += `<div class="news-date">📅 ${formatArabicDate(new Date(newsItem.date))}</div>`;
        }
        
        // Only add title if it exists
        if (newsItem.title) {
            contentHTML += `<h3 class="news-title">${newsItem.title}</h3>`;
        }
        
        // Only add details if they exist
        if (newsItem.details) {
            contentHTML += `<div class="news-details">${newsItem.details}</div>`;
        }
        
        contentHTML += '</div>';
        
        card.innerHTML = contentHTML;
        container.appendChild(card);
    });
}

// Open image in modal
function openImageModal(imageUrl) {
    const modal = document.getElementById('match-modal');
    const detailsContainer = document.getElementById('match-details');
    
    detailsContainer.innerHTML = `
        <div style="text-align: center;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 80vh; object-fit: contain;" alt="صورة">
        </div>
    `;
    
    showModal(modal);
}

// Toggle season selector on mobile
function toggleSeasonSelector() {
    const selector = document.querySelector('.season-selector');
    const toggleBtn = document.querySelector('.season-toggle-btn');
    
    if (selector && toggleBtn) {
        selector.classList.toggle('active');
        
        if (selector.classList.contains('active')) {
            toggleBtn.textContent = '×';
        } else {
            toggleBtn.textContent = '☰';
        }
    }
}

// Toggle weeks sidebar on mobile
function toggleWeeksSidebar() {
    const sidebar = document.querySelector('.weeks-sidebar');
    const toggleBtn = document.querySelector('.weeks-toggle-btn');
    
    if (sidebar && toggleBtn) {
        sidebar.classList.toggle('active');
        
        if (sidebar.classList.contains('active')) {
            toggleBtn.textContent = '×';
        } else {
            toggleBtn.textContent = '📅';
        }
    }
}

// Display venues
// Store all venues globally for filtering
let allVenues = [];

function displayVenues() {
    const container = document.getElementById('venues-container');
    
    if (!mainData || !mainData.venues || mainData.venues.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد ملاعب متاحة</div>';
        return;
    }
    
    // Store venues globally
    allVenues = mainData.venues;
    
    // Render all venues initially
    renderVenues(allVenues);
}

function renderVenues(venues) {
    const container = document.getElementById('venues-container');
    
    if (!venues || venues.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد نتائج</div>';
        return;
    }
    
    container.innerHTML = '<div class="venues-grid"></div>';
    const grid = container.querySelector('.venues-grid');
    
    venues.forEach(venue => {
        const card = document.createElement('div');
        card.className = 'venue-card';
        
        card.innerHTML = `
            <div class="venue-name">📍 ${venue.name}</div>
            <a href="${venue.url}" target="_blank" class="venue-link">
                عرض على الخريطة 🗺️
            </a>
        `;
        
        grid.appendChild(card);
    });
}

function filterVenues() {
    const searchInput = document.getElementById('venue-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        renderVenues(allVenues);
        return;
    }
    
    const filteredVenues = allVenues.filter(venue => 
        venue.name.toLowerCase().includes(searchTerm)
    );
    
    renderVenues(filteredVenues);
}

// Page navigation
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // Add active class to clicked button if exists
    if (event && event.target) {
        const navBtn = event.target.closest('.nav-btn');
        if (navBtn) {
            navBtn.classList.add('active');
        }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Setup sticky tabs for competition matches page
    if (pageName === 'competition-matches') {
        // Reset tabs state when entering the page
        const tabs = document.querySelector('.competition-tabs');
        const toggleBtn = document.querySelector('.tabs-toggle-btn');
        if (tabs) {
            tabs.classList.remove('collapsed');
            tabs.classList.remove('scrolled');
        }
        if (toggleBtn) {
            toggleBtn.classList.remove('visible');
            toggleBtn.classList.remove('collapsed');
            toggleBtn.textContent = '▲ إخفاء القائمة';
        }
        setTimeout(setupStickyTabs, 100);
    }
}

// Sticky tabs functionality
function setupStickyTabs() {
    const tabs = document.querySelector('.competition-tabs');
    const toggleBtn = document.querySelector('.tabs-toggle-btn');
    if (!tabs) return;
    
    const handleScroll = () => {
        if (window.pageYOffset > 100) {
            tabs.classList.add('scrolled');
            if (toggleBtn) toggleBtn.classList.add('visible');
        } else {
            tabs.classList.remove('scrolled');
            if (toggleBtn) {
                toggleBtn.classList.remove('visible');
                // Also expand tabs when scrolling back to top
                tabs.classList.remove('collapsed');
                toggleBtn.classList.remove('collapsed');
                toggleBtn.textContent = '▲ إخفاء القائمة';
            }
        }
    };
    
    // Remove existing listener if any
    window.removeEventListener('scroll', handleScroll);
    // Add new listener
    window.addEventListener('scroll', handleScroll);
}

// Toggle tabs visibility
function toggleTabs() {
    const tabs = document.querySelector('.competition-tabs');
    const toggleBtn = document.querySelector('.tabs-toggle-btn');
    
    if (tabs && toggleBtn) {
        tabs.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
        
        if (tabs.classList.contains('collapsed')) {
            toggleBtn.textContent = '▼ إظهار القائمة';
        } else {
            toggleBtn.textContent = '▲ إخفاء القائمة';
        }
    }
}

// Show age selection modal
function showAgeSelectionModal(seasonName, competitionIndex) {
    const season = mainData.seasons.find(s => s.season === seasonName);
    if (!season) return;
    
    const competition = season.competitions[competitionIndex];
    if (!competition || !competition.ages || competition.ages.length === 0) {
        alert('لا توجد فئات عمرية متاحة لهذه البطولة');
        return;
    }
    
    const modal = document.getElementById('age-modal');
    const ageOptions = document.getElementById('age-options');
    
    ageOptions.innerHTML = '';
    competition.ages.forEach(ageData => {
        const btn = document.createElement('button');
        btn.className = 'age-option-btn';
        btn.textContent = `مواليد ${ageData.age}`;
        btn.onclick = () => {
            closeAgeModal();
            // Check if this age has sectors
            if (ageData.sector !== null && ageData.sector !== undefined) {
                showSectorSelectionModal(competition, ageData, seasonName);
            } else {
                loadCompetitionMatches(competition, ageData, seasonName);
            }
        };
        ageOptions.appendChild(btn);
    });
    
    showModal(modal);
}

// Close age modal
function closeAgeModal() {
    const modal = document.getElementById('age-modal');
    hideModal(modal);
}

// Show sector selection modal
function showSectorSelectionModal(competition, ageData, seasonName) {
    const modal = document.getElementById('sector-modal');
    const sectorOptions = document.getElementById('sector-options');
    
    const sectorNames = ageData.sector.ar || ageData.sector;
    const matchesUrls = Array.isArray(ageData.matchesurl) ? ageData.matchesurl : [ageData.matchesurl];
    
    sectorOptions.innerHTML = '';
    sectorNames.forEach((sectorName, index) => {
        const btn = document.createElement('button');
        btn.className = 'age-option-btn';
        btn.textContent = sectorName;
        btn.onclick = () => {
            closeSectorModal();
            loadSingleSectorMatches(competition, ageData, seasonName, sectorName, matchesUrls[index]);
        };
        sectorOptions.appendChild(btn);
    });
    
    showModal(modal);
}

// Close sector modal
function closeSectorModal() {
    const modal = document.getElementById('sector-modal');
    hideModal(modal);
}

// Load competition matches
async function loadCompetitionMatches(competition, ageData, seasonName) {
    const container = document.getElementById('competition-matches-container');
    const title = document.getElementById('competition-title');
    
    title.textContent = `${competition.name.ar} - مواليد ${ageData.age} - ${seasonName}`;
    
    container.innerHTML = '<div class="loading"><div class="loader"></div><p>جاري تحميل المباريات...</p></div>';
    
    // Reset to matches tab
    resetCompetitionTabs();
    
    showPage('competition-matches');
    
    try {
        // Check if competition has sectors (multiple groups)
        const hasSectors = ageData.sector !== null && ageData.sector !== undefined;
        
        if (hasSectors) {
            // Load all sector matches
            const matchesUrls = Array.isArray(ageData.matchesurl) ? ageData.matchesurl : [ageData.matchesurl];
            const sectorNames = ageData.sector.ar || ageData.sector;
            
            allMatches = []; // Reset global allMatches
            
            for (let i = 0; i < matchesUrls.length; i++) {
                const response = await fetch(matchesUrls[i]);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (data.matches && data.matches.length > 0) {
                    // Add sector information to each match (only if match doesn't already have group)
                    data.matches.forEach(match => {
                        allMatches.push({
                            ...match,
                            teams: data.teams,
                            competition: competition.name.ar,
                            age: ageData.age,
                            season: seasonName,
                            sector: match.group ? null : (sectorNames[i] || `مجموعة ${i + 1}`)
                        });
                    });
                }
            }
            
            if (allMatches.length === 0) {
                container.innerHTML = '<div class="no-data">لا توجد مباريات في هذه البطولة</div>';
                return;
            }
            
            displayMatchesByWeeksAndSectors(allMatches);
        } else {
            // Single competition without sectors (original logic)
            const response = await fetch(ageData.matchesurl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            if (!data.matches || data.matches.length === 0) {
                container.innerHTML = '<div class="no-data">لا توجد مباريات في هذه البطولة</div>';
                return;
            }
            
            // Add teams data to each match
            allMatches = data.matches.map(match => ({
                ...match,
                teams: data.teams,
                competition: competition.name.ar,
                age: ageData.age,
                season: seasonName
            }));
            
            displayMatchesByWeeks(allMatches);
        }
    } catch (error) {
        console.error('Error loading competition matches:', error);
        container.innerHTML = '<div class="no-data">فشل تحميل المباريات</div>';
    }
}

// Load single sector matches (when user selects a specific group)
async function loadSingleSectorMatches(competition, ageData, seasonName, sectorName, sectorUrl) {
    const container = document.getElementById('competition-matches-container');
    const title = document.getElementById('competition-title');
    
    title.textContent = `${competition.name.ar} - مواليد ${ageData.age} - ${sectorName} - ${seasonName}`;
    
    container.innerHTML = '<div class="loading"><div class="loader"></div><p>جاري تحميل المباريات...</p></div>';
    
    // Reset to matches tab
    resetCompetitionTabs();
    
    showPage('competition-matches');
    
    try {
        const response = await fetch(sectorUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (!data.matches || data.matches.length === 0) {
            container.innerHTML = '<div class="no-data">لا توجد مباريات في هذه المجموعة</div>';
            return;
        }
        
        // Add teams data to each match
        allMatches = data.matches.map(match => ({
            ...match,
            teams: data.teams,
            competition: competition.name.ar,
            age: ageData.age,
            season: seasonName,
            sector: sectorName
        }));
        
        displayMatchesByWeeks(allMatches);
    } catch (error) {
        console.error('Error loading sector matches:', error);
        container.innerHTML = '<div class="no-data">فشل تحميل المباريات</div>';
    }
}

// Display matches organized by weeks
function displayMatchesByWeeks(matches) {
    const container = document.getElementById('competition-matches-container');
    const weeksList = document.getElementById('weeks-list');
    
    // Check if any match has a group property
    const hasGroups = matches.some(match => match.group);
    
    if (hasGroups) {
        // If matches have groups, use the sector-based display
        displayMatchesByWeeksAndSectors(matches);
        return;
    }
    
    // Group matches by date, then by week
    const dateGroups = {};
    matches.forEach(match => {
        const date = match.date || 'غير محدد';
        const week = match.week || 'غير محدد';
        
        if (!dateGroups[date]) {
            dateGroups[date] = {};
        }
        
        if (!dateGroups[date][week]) {
            dateGroups[date][week] = [];
        }
        
        dateGroups[date][week].push(match);
    });
    
    // Sort matches within each week by time
    Object.keys(dateGroups).forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            dateGroups[date][week].sort((a, b) => {
                const timeA = a.time || '00:00';
                const timeB = b.time || '00:00';
                return timeA.localeCompare(timeB);
            });
        });
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return new Date(a) - new Date(b);
    });
    
    // Collect unique weeks for navigation (sorted)
    const allWeeks = new Set();
    sortedDates.forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            allWeeks.add(week);
        });
    });
    
    const sortedWeeks = Array.from(allWeeks).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return parseInt(a) - parseInt(b);
    });
    
    // Create week navigation buttons
    weeksList.innerHTML = '';
    sortedWeeks.forEach(week => {
        const btn = document.createElement('button');
        btn.className = 'week-btn';
        btn.textContent = week === 'غير محدد' ? week : `الأسبوع ${week}`;
        btn.onclick = () => scrollToWeek(week);
        weeksList.appendChild(btn);
    });
    
    // Find the nearest upcoming match
    const now = new Date();
    let nearestUpcomingMatch = null;
    let nearestWeek = null;
    let minTimeDiff = Infinity;
    
    sortedDates.forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            dateGroups[date][week].forEach(match => {
                if (match.status === 'upcoming' || match.status === 'scheduled') {
                    const matchDate = new Date(`${match.date} ${match.time || '00:00'}`);
                    const timeDiff = matchDate - now;
                    
                    if (timeDiff >= 0 && timeDiff < minTimeDiff) {
                        minTimeDiff = timeDiff;
                        nearestUpcomingMatch = match;
                        nearestWeek = week;
                    }
                }
            });
        });
    });
    
    // Display matches by date, then by week
    container.innerHTML = '';
    sortedDates.forEach(date => {
        const dateSection = document.createElement('div');
        dateSection.className = 'date-section';
        
        // Get all weeks for this date
        const weeksInDate = Object.keys(dateGroups[date]);
        
        weeksInDate.forEach(week => {
            const weekSection = document.createElement('div');
            weekSection.className = 'week-section';
            weekSection.id = `week-${week}-${date}`;
            
            // Get first match to extract competition info
            const firstMatch = dateGroups[date][week][0];
            const competitionInfo = `${firstMatch.competition || 'بطولة'} - ${firstMatch.age || ''}`;
            const dateInfo = formatArabicDate(new Date(date));
            
            const weekHeader = document.createElement('div');
            weekHeader.className = 'week-header';
            weekHeader.innerHTML = `
                <div class="week-header-content">
                    <h3 class="week-number">${week === 'غير محدد' ? week : `الأسبوع ${week}`}</h3>
                    <span class="week-competition">${competitionInfo}</span>
                    <span class="week-date">${dateInfo}</span>
                </div>
            `;
            weekSection.appendChild(weekHeader);
            
            const matchesGrid = document.createElement('div');
            matchesGrid.className = 'matches-grid';
            
            dateGroups[date][week].forEach(match => {
                const card = createMatchCard(match, true);
                
                // Mark the nearest upcoming match
                if (match === nearestUpcomingMatch) {
                    card.id = 'nearest-upcoming-match';
                }
                
                matchesGrid.appendChild(card);
            });
            
            weekSection.appendChild(matchesGrid);
            dateSection.appendChild(weekSection);
        });
        
        container.appendChild(dateSection);
    });
    
    // Scroll to the nearest upcoming match after a short delay
    setTimeout(() => {
        if (nearestUpcomingMatch) {
            const targetCard = document.getElementById('nearest-upcoming-match');
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight the card briefly
                targetCard.style.border = '3px solid #7e0000';
                targetCard.style.boxShadow = '0 0 20px rgba(126, 0, 0, 0.5)';
                
                setTimeout(() => {
                    targetCard.style.border = '';
                    targetCard.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
                }, 2000);
                
                // Update active week button
                document.querySelectorAll('.week-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.textContent === (nearestWeek === 'غير محدد' ? nearestWeek : `الأسبوع ${nearestWeek}`)) {
                        btn.classList.add('active');
                    }
                });
            }
        }
    }, 300);
}

// Display matches organized by weeks and sectors (for competitions with groups)
function displayMatchesByWeeksAndSectors(matches) {
    const container = document.getElementById('competition-matches-container');
    const weeksList = document.getElementById('weeks-list');
    
    // Group matches by date, week, and sector
    const dateGroups = {};
    matches.forEach(match => {
        const date = match.date || 'غير محدد';
        const week = match.week || 'غير محدد';
        // Use group if available, otherwise use sector
        const sector = match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة');
        
        if (!dateGroups[date]) {
            dateGroups[date] = {};
        }
        
        if (!dateGroups[date][week]) {
            dateGroups[date][week] = {};
        }
        
        if (!dateGroups[date][week][sector]) {
            dateGroups[date][week][sector] = [];
        }
        
        dateGroups[date][week][sector].push(match);
    });
    
    // Sort matches within each sector by time
    Object.keys(dateGroups).forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            Object.keys(dateGroups[date][week]).forEach(sector => {
                dateGroups[date][week][sector].sort((a, b) => {
                    const timeA = a.time || '00:00';
                    const timeB = b.time || '00:00';
                    return timeA.localeCompare(timeB);
                });
            });
        });
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return new Date(a) - new Date(b);
    });
    
    // Collect unique weeks for navigation (sorted)
    const allWeeks = new Set();
    sortedDates.forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            allWeeks.add(week);
        });
    });
    
    const sortedWeeks = Array.from(allWeeks).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return parseInt(a) - parseInt(b);
    });
    
    // Create week navigation buttons
    weeksList.innerHTML = '';
    sortedWeeks.forEach(week => {
        const btn = document.createElement('button');
        btn.className = 'week-btn';
        btn.textContent = week === 'غير محدد' ? week : `الأسبوع ${week}`;
        btn.onclick = () => scrollToWeek(week);
        weeksList.appendChild(btn);
    });
    
    // Find the nearest upcoming match
    const now = new Date();
    let nearestUpcomingMatch = null;
    let nearestWeek = null;
    let minTimeDiff = Infinity;
    
    sortedDates.forEach(date => {
        Object.keys(dateGroups[date]).forEach(week => {
            Object.keys(dateGroups[date][week]).forEach(sector => {
                dateGroups[date][week][sector].forEach(match => {
                    if (match.status === 'upcoming' || match.status === 'scheduled') {
                        const matchDate = new Date(`${match.date} ${match.time || '00:00'}`);
                        const timeDiff = matchDate - now;
                        
                        if (timeDiff >= 0 && timeDiff < minTimeDiff) {
                            minTimeDiff = timeDiff;
                            nearestUpcomingMatch = match;
                            nearestWeek = week;
                        }
                    }
                });
            });
        });
    });
    
    // Display matches by date, then by week and sector
    container.innerHTML = '';
    sortedDates.forEach(date => {
        const dateSection = document.createElement('div');
        dateSection.className = 'date-section';
        
        // Get all weeks for this date
        const weeksInDate = Object.keys(dateGroups[date]);
        
        weeksInDate.forEach(week => {
            const weekSection = document.createElement('div');
            weekSection.className = 'week-section';
            weekSection.id = `week-${week}-${date}`;
            
            // Get all sectors for this week on this date
            const sectors = Object.keys(dateGroups[date][week]);
            
            // Display each sector within the week
            sectors.forEach(sector => {
                const sectorContainer = document.createElement('div');
                sectorContainer.className = 'sector-container';
                
                // Get first match to extract competition info
                const firstMatch = dateGroups[date][week][sector][0];
                const competitionInfo = `${firstMatch.competition || 'بطولة'} - ${firstMatch.age || ''}`;
                const dateInfo = formatArabicDate(new Date(date));
                
                console.log('Sector value:', sector); // Debug log
                console.log('First match group:', firstMatch.group); // Debug log
                
                const sectorHeader = document.createElement('div');
                sectorHeader.className = 'sector-header';
                sectorHeader.innerHTML = `
                    <div class="sector-header-content">
                        <h3 class="sector-number">${week === 'غير محدد' ? week : `الأسبوع ${week}`}</h3>
                        <span class="sector-competition">${sector}</span>
                        <span class="sector-date">${dateInfo}</span>
                    </div>
                `;
                sectorContainer.appendChild(sectorHeader);
                
                const matchesGrid = document.createElement('div');
                matchesGrid.className = 'matches-grid';
                
                dateGroups[date][week][sector].forEach(match => {
                    const card = createMatchCard(match, true);
                    
                    // Mark the nearest upcoming match
                    if (match === nearestUpcomingMatch) {
                        card.id = 'nearest-upcoming-match';
                    }
                    
                    matchesGrid.appendChild(card);
                });
                
                sectorContainer.appendChild(matchesGrid);
                weekSection.appendChild(sectorContainer);
            });
            
            dateSection.appendChild(weekSection);
        });
        
        container.appendChild(dateSection);
    });
    
    // Scroll to the nearest upcoming match after a short delay
    setTimeout(() => {
        if (nearestUpcomingMatch) {
            const targetCard = document.getElementById('nearest-upcoming-match');
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight the card briefly
                targetCard.style.border = '3px solid #7e0000';
                targetCard.style.boxShadow = '0 0 20px rgba(126, 0, 0, 0.5)';
                
                setTimeout(() => {
                    targetCard.style.border = '';
                    targetCard.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
                }, 2000);
                
                // Update active week button
                document.querySelectorAll('.week-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.textContent === (nearestWeek === 'غير محدد' ? nearestWeek : `الأسبوع ${nearestWeek}`)) {
                        btn.classList.add('active');
                    }
                });
            }
        }
    }, 300);
}

// Scroll to specific week
function scrollToWeek(week) {
    // Find the first section with this week number
    const allSections = document.querySelectorAll('.week-section');
    let targetSection = null;
    
    for (const section of allSections) {
        if (section.id.startsWith(`week-${week}-`) || section.id === `week-${week}`) {
            targetSection = section;
            break;
        }
    }
    
    if (targetSection) {
        // Close weeks sidebar on mobile if open
        const sidebar = document.querySelector('.weeks-sidebar');
        const toggleBtn = document.querySelector('.weeks-toggle-btn');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if (toggleBtn) toggleBtn.textContent = '📅';
        }
        
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Update active button
        document.querySelectorAll('.week-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const matchModal = document.getElementById('match-modal');
    const ageModal = document.getElementById('age-modal');
    const sectorModal = document.getElementById('sector-modal');
    
    if (event.target === matchModal) {
        hideModal(matchModal);
    }
    if (event.target === ageModal) {
        hideModal(ageModal);
    }
    if (event.target === sectorModal) {
        hideModal(sectorModal);
    }
}

// ==================== TAB MANAGEMENT ====================
function resetCompetitionTabs() {
    // Show matches tab by default
    document.querySelectorAll('.competition-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById('matches-tab').classList.add('active');
    const matchesBtn = document.querySelector('.tab-btn[onclick*="matches"]');
    if (matchesBtn) matchesBtn.classList.add('active');
    
    // Clear other tab contents
    const standingsContainer = document.getElementById('standings-container');
    const teamsContainer = document.getElementById('teams-container');
    
    if (standingsContainer) standingsContainer.innerHTML = '';
    if (teamsContainer) teamsContainer.innerHTML = '';
    
    // Clear all statistics sections (they are the section divs themselves)
    const scorersSection = document.getElementById('scorers-section');
    const assistsSection = document.getElementById('assists-section');
    const cleansheetsSection = document.getElementById('cleansheets-section');
    
    if (scorersSection) scorersSection.innerHTML = '';
    if (assistsSection) assistsSection.innerHTML = '';
    if (cleansheetsSection) cleansheetsSection.innerHTML = '';
    
    // Reset statistics tab to scorers
    document.querySelectorAll('.stats-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.stats-btn').forEach(btn => btn.classList.remove('active'));
    if (scorersSection) scorersSection.classList.add('active');
    const scorersBtn = document.querySelector('.stats-btn[onclick*="scorers"]');
    if (scorersBtn) scorersBtn.classList.add('active');
}

function showCompetitionTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.competition-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Load content if needed
    if (tabName === 'standings' && allMatches.length > 0) {
        displayStandings();
    } else if (tabName === 'statistics' && allMatches.length > 0) {
        // Reset to scorers section and clear old data
        document.querySelectorAll('.stats-section').forEach(sec => sec.classList.remove('active'));
        document.querySelectorAll('.stats-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById('analysis-section').classList.add('active');
        const analysisBtn = document.querySelector('.stats-btn[onclick*="analysis"]');
        if (analysisBtn) analysisBtn.classList.add('active');
        
        // Clear all stats sections first (they are the section divs themselves)
        document.getElementById('analysis-section').innerHTML = '';
        document.getElementById('scorers-section').innerHTML = '';
        document.getElementById('assists-section').innerHTML = '';
        document.getElementById('cleansheets-section').innerHTML = '';
        
        // Load analysis data
        displayStatistics('analysis');
    } else if (tabName === 'teams' && allMatches.length > 0) {
        displayTeams();
    }
}

function showStatsSection(section) {
    document.querySelectorAll('.stats-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.stats-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');
    
    displayStatistics(section);
}

// ==================== STANDINGS ====================
function displayStandings() {
    const container = document.getElementById('standings-container');
    
    console.log('displayStandings called - allMatches:', allMatches.length);
    if (allMatches.length > 0) {
        console.log('First match sample:', allMatches[0]);
    }
    
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    // Get teams data from first match (all matches should have same teams array)
    const teamsData = allMatches[0]?.teams || [];
    
    if (teamsData.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات الفرق</div>';
        return;
    }
    
    // Build team ID to group map from the definitive teamsData list
    const teamIdToGroupMap = {};
    teamsData.forEach(team => {
        teamIdToGroupMap[team.team_id] = team.group || null;
    });
    
    // Check if any team has a group
    const hasGroups = Object.values(teamIdToGroupMap).some(group => group && group !== 'null' && group !== '');
    
    // Group teams by their team.group property (البطولة, الهبوط, etc.)
    const groups = {};
    teamsData.forEach(team => {
        const teamGroup = team.group;
        const groupName = hasGroups && teamGroup && teamGroup !== 'null' && teamGroup !== '' 
            ? teamGroup 
            : 'all';
        
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(team.team_id);
    });
    
    console.log('Standings groups:', Object.keys(groups));
    
    container.innerHTML = '';
    
    Object.keys(groups).sort().forEach(groupName => {
        const teamIds = groups[groupName]; // It's already an array
        const standings = calculateStandings(teamIds, teamIdToGroupMap);
        
        if (hasGroups && groupName !== 'all') {
            const groupHeader = document.createElement('h3');
            groupHeader.textContent = groupName;
            groupHeader.style.cssText = 'background: #7e0000; color: white; padding: 15px 20px; margin: 20px 0 10px 0; border-radius: 10px; text-align: center;';
            container.appendChild(groupHeader);
        }
        
        container.appendChild(createStandingsTable(standings, teamsData));
    });
}

function calculateStandings(teamIds, teamIdToGroupMap) {
    const standings = {};
    
    // Get the group for this standings calculation
    const standingsGroup = teamIdToGroupMap && teamIds.length > 0 
        ? teamIdToGroupMap[teamIds[0]] 
        : null;
    
    // Initialize standings for each team in this group
    teamIds.forEach(teamId => {
        standings[teamId] = {
            teamId: teamId,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0,
            penaltyPoints: 0
        };
    });
    
    // Process ALL matches - for each match, check if any team from our standings group is involved
    allMatches.forEach(match => {
        if (match.status !== 'completed') return;
        
        // Ignore knockout matches for standings
        if (match.stage && match.stage.toLowerCase() === 'knockout') return;
        
        const homeId = match.home_team_id;
        const awayId = match.away_team_id;
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        const penaltyWinnerId = match.penalty_winner_team_id || null;
        
        const homeInGroup = standings[homeId] !== undefined;
        const awayInGroup = standings[awayId] !== undefined;
        
        // Only process if at least one team is in our standings group
        if (!homeInGroup && !awayInGroup) return;
        
        // Process home team stats if in group
        if (homeInGroup) {
            standings[homeId].played++;
            standings[homeId].goalsFor += homeScore;
            standings[homeId].goalsAgainst += awayScore;
            
            if (homeScore > awayScore) {
                standings[homeId].won++;
                standings[homeId].points += 3;
            } else if (awayScore > homeScore) {
                standings[homeId].lost++;
            } else {
                // Draw
                standings[homeId].drawn++;
                standings[homeId].points++;
                
                // Penalty shootout bonus point
                if (penaltyWinnerId === homeId) {
                    standings[homeId].points++;
                    standings[homeId].penaltyPoints++;
                }
            }
        }
        
        // Process away team stats if in group
        if (awayInGroup) {
            standings[awayId].played++;
            standings[awayId].goalsFor += awayScore;
            standings[awayId].goalsAgainst += homeScore;
            
            if (awayScore > homeScore) {
                standings[awayId].won++;
                standings[awayId].points += 3;
            } else if (homeScore > awayScore) {
                standings[awayId].lost++;
            } else {
                // Draw
                standings[awayId].drawn++;
                standings[awayId].points++;
                
                // Penalty shootout bonus point
                if (penaltyWinnerId === awayId) {
                    standings[awayId].points++;
                    standings[awayId].penaltyPoints++;
                }
            }
        }
    });
    
    // Calculate goal difference
    Object.values(standings).forEach(team => {
        team.goalDiff = team.goalsFor - team.goalsAgainst;
    });
    
    // Get teams data for alphabetical sorting
    const teamsData = allMatches.length > 0 && allMatches[0].teams ? allMatches[0].teams : [];
    
    // Sort with head-to-head tiebreaker
    return Object.values(standings).sort((a, b) => {
        // 1. Compare by points
        if (b.points !== a.points) return b.points - a.points;
        
        // 2. Head-to-head tiebreaker (only if 2+ matches played between teams)
        if (a.points === b.points && a.points > 0) {
            const h2hResult = getHeadToHeadResult(a.teamId, b.teamId, teamsData);
            if (h2hResult !== 0) return h2hResult;
        }
        
        // 3. Compare by goal difference
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        
        // 4. Compare by goals scored
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        
        // 5. Alphabetical by team name
        const teamAInfo = getTeamInfoById(a.teamId, teamsData);
        const teamBInfo = getTeamInfoById(b.teamId, teamsData);
        const teamAName = teamAInfo ? (teamAInfo.name || teamAInfo.teamName || '') : '';
        const teamBName = teamBInfo ? (teamBInfo.name || teamBInfo.teamName || '') : '';
        return teamAName.localeCompare(teamBName, 'ar');
    });
}

// Helper function to get team info by ID
function getTeamInfoById(teamId, teamsData) {
    if (!teamsData || !Array.isArray(teamsData)) return null;
    return teamsData.find(team => team.team_id === teamId);
}

// Get head-to-head result between two teams (only applied if 2+ matches played)
function getHeadToHeadResult(teamA, teamB, teamsData) {
    let teamAPoints = 0;
    let teamBPoints = 0;
    let teamAGoalsFor = 0;
    let teamAGoalsAgainst = 0;
    let h2hMatchesPlayed = 0;
    
    // Find all matches between these two teams
    allMatches.forEach(match => {
        if (match.status !== 'completed') return;
        
        // Ignore knockout matches in head-to-head
        if (match.stage && match.stage.toLowerCase() === 'knockout') return;
        
        const isMatchBetweenTeams = 
            (match.home_team_id === teamA && match.away_team_id === teamB) ||
            (match.home_team_id === teamB && match.away_team_id === teamA);
        
        if (!isMatchBetweenTeams) return;
        
        h2hMatchesPlayed++;
        
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        
        if (match.home_team_id === teamA) {
            teamAGoalsFor += homeScore;
            teamAGoalsAgainst += awayScore;
            
            if (homeScore > awayScore) {
                teamAPoints += 3;
            } else if (homeScore === awayScore) {
                teamAPoints += 1;
                teamBPoints += 1;
            } else {
                teamBPoints += 3;
            }
        } else {
            teamAGoalsFor += awayScore;
            teamAGoalsAgainst += homeScore;
            
            if (awayScore > homeScore) {
                teamAPoints += 3;
            } else if (homeScore === awayScore) {
                teamAPoints += 1;
                teamBPoints += 1;
            } else {
                teamBPoints += 3;
            }
        }
    });
    
    // Only apply head-to-head if 2 or more matches played
    if (h2hMatchesPlayed < 2) {
        return 0;
    }
    
    // Compare H2H points
    if (teamBPoints !== teamAPoints) {
        return teamBPoints - teamAPoints;
    }
    
    // Compare H2H goal difference
    const teamAGD = teamAGoalsFor - teamAGoalsAgainst;
    const teamBGD = -teamAGD; // Reverse for teamB
    if (teamBGD !== teamAGD) {
        return teamBGD - teamAGD;
    }
    
    // If H2H is tied, return 0 to move to next tiebreaker
    return 0;
}

function createStandingsTable(standings, teamsData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'standings-table-wrapper';
    wrapper.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px;';
    
    const table = document.createElement('div');
    table.className = 'standings-table';
    
    // Create a map for quick team info lookup
    const teamInfoMap = {};
    if (teamsData && Array.isArray(teamsData)) {
        teamsData.forEach(team => {
            teamInfoMap[team.team_id] = {
                name: team.name || team.teamName || team.team_name || 'فريق غير معروف',
                logo: team.logo || null
            };
        });
    }
    
    let html = `
        <table class="standings-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>الفريق</th>
                    <th>لعب</th>
                    <th>نقاط</th>
                    <th>فاز</th>
                    <th>تعادل</th>
                    <th>خسر</th>
                    <th>له</th>
                    <th>عليه</th>
                    <th>الفارق</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    standings.forEach((team, index) => {
        const teamInfo = teamInfoMap[team.teamId] || { name: 'فريق غير معروف', logo: null };
        
        html += `
            <tr>
                <td class="position-cell">${index + 1}</td>
                <td>
                    <div class="team-cell">
                        ${teamInfo.logo ? `<img src="${teamInfo.logo}" class="team-logo" alt="${teamInfo.name}">` : ''}
                        <span class="team-name">${teamInfo.name}</span>
                    </div>
                </td>
                <td>${team.played}</td>
                <td class="points-cell">${team.points}</td>
                <td>${team.won}</td>
                <td>${team.drawn}</td>
                <td>${team.lost}</td>
                <td>${team.goalsFor}</td>
                <td>${team.goalsAgainst}</td>
                <td>${team.goalDiff > 0 ? '+' : ''}${team.goalDiff}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    table.innerHTML = html;
    wrapper.appendChild(table);
    return wrapper;
}

// ==================== STATISTICS ====================
function displayStatistics(type) {
    const containerId = `${type}-section`;
    const container = document.getElementById(containerId);
    
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    if (type === 'analysis') {
        displayComprehensiveAnalysis(container);
    } else if (type === 'scorers') {
        displayScorers(container);
    } else if (type === 'assists') {
        displayAssists(container);
    } else if (type === 'cleansheets') {
        displayCleanSheets(container);
    }
}

function displayComprehensiveAnalysis(container) {
    // Group completed matches by stages/groups (like Android extension)
    const matchesByBucket = smartGroupCompletedMatches();
    
    if (Object.keys(matchesByBucket).length === 0) {
        container.innerHTML = '<div class="analysis-container"><div class="analysis-card"><div class="analysis-label">لا توجد مباريات مكتملة</div></div></div>';
        return;
    }
    
    // Sort bucket names (stages first, then groups, then overall)
    const sortedBuckets = Object.keys(matchesByBucket).sort((a, b) => {
        if (a === 'المرحلة الاولي') return -1;
        if (b === 'المرحلة الاولي') return 1;
        if (a === 'إحصائيات عامة') return -1;
        if (b === 'إحصائيات عامة') return 1;
        return a.localeCompare(b);
    });
    
    let html = '<div class="analysis-container">';
    
    // Process each bucket (stage/group)
    sortedBuckets.forEach(bucketName => {
        const bucketMatches = matchesByBucket[bucketName];
        
        // Add group header if not overall stats
        if (bucketName !== 'إحصائيات عامة') {
            html += `<h3 class="analysis-title">${bucketName}</h3>`;
        }
        
        html += '<div class="analysis-grid">';
        
        // Calculate all statistics for this bucket
        const stats = [
            { label: 'إجمالي المباريات المكتملة', value: calculateStatForGroup(bucketMatches, 'total_matches') },
            { label: 'إجمالي الأهداف المسجلة', value: calculateStatForGroup(bucketMatches, 'total_goals') },
            { label: 'معدل الأهداف / مباراة', value: calculateStatForGroup(bucketMatches, 'goal_rate') },
            { label: 'مباريات انتهت بفوز', value: calculateStatForGroup(bucketMatches, 'winner_matches') },
            { label: 'مباريات انتهت بالتعادل', value: calculateStatForGroup(bucketMatches, 'draw_matches') },
            { label: 'أقوى خط هجوم', value: calculateStatForGroup(bucketMatches, 'strongest_attack'), highlight: true },
            { label: 'أقوى خط دفاع', value: calculateStatForGroup(bucketMatches, 'strongest_defense'), highlight: true },
            { label: 'أضعف خط هجوم', value: calculateStatForGroup(bucketMatches, 'weakest_attack'), highlight: true },
            { label: 'أضعف خط دفاع', value: calculateStatForGroup(bucketMatches, 'weakest_defense'), highlight: true }
        ];
        
        stats.forEach(stat => {
            const cardClass = stat.highlight ? 'analysis-card highlight' : 'analysis-card';
            html += `
                <div class="${cardClass}">
                    <div class="analysis-label">${stat.label}</div>
                    <div class="analysis-value">${stat.value}</div>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Group completed matches by stage/group (exactly like Android extension)
function smartGroupCompletedMatches() {
    const matchesByBucket = {};
    
    // Build team ID to group map from teams data
    const teamIdToGroupMap = {};
    allMatches.forEach(match => {
        // Get the actual team's group property from the team object
        const homeTeam = getTeamInfo(match, match.home_team_id);
        const awayTeam = getTeamInfo(match, match.away_team_id);
        
        // Store each team's actual group (from team data, not match data)
        if (!teamIdToGroupMap[match.home_team_id]) {
            teamIdToGroupMap[match.home_team_id] = homeTeam.group || null;
        }
        if (!teamIdToGroupMap[match.away_team_id]) {
            teamIdToGroupMap[match.away_team_id] = awayTeam.group || null;
        }
    });
    
    console.log('Team groups map:', teamIdToGroupMap);
    
    // Group matches based on team groups ONLY
    allMatches.forEach(match => {
        if (match.status !== 'completed') return;
        
        const homeTeamGroup = teamIdToGroupMap[match.home_team_id];
        const awayTeamGroup = teamIdToGroupMap[match.away_team_id];
        
        console.log(`Match: ${match.home_team_id} (${homeTeamGroup}) vs ${match.away_team_id} (${awayTeamGroup})`);
        
        let bucketKey;
        
        // If both teams are from the same group, use that group name directly
        // (e.g., both from "البطولة" → bucket = "البطولة")
        if (homeTeamGroup && awayTeamGroup && homeTeamGroup === awayTeamGroup && 
            homeTeamGroup !== '' && homeTeamGroup !== 'null') {
            bucketKey = homeTeamGroup;  // Use team group directly: "البطولة" or "الهبوط"
        }
        // If teams are from different groups, this is المرحلة الاولي
        else if (homeTeamGroup && awayTeamGroup && homeTeamGroup !== awayTeamGroup && 
                 homeTeamGroup !== '' && homeTeamGroup !== 'null' && 
                 awayTeamGroup !== '' && awayTeamGroup !== 'null') {
            bucketKey = 'المرحلة الاولي';
        }
        // If only one team has a group, use it
        else if (homeTeamGroup && homeTeamGroup !== '' && homeTeamGroup !== 'null') {
            bucketKey = homeTeamGroup;
        }
        else if (awayTeamGroup && awayTeamGroup !== '' && awayTeamGroup !== 'null') {
            bucketKey = awayTeamGroup;
        }
        // No groups at all
        else {
            bucketKey = 'إحصائيات عامة';
        }
        
        console.log(`  → Bucket: ${bucketKey}`);
        
        if (!matchesByBucket[bucketKey]) {
            matchesByBucket[bucketKey] = [];
        }
        matchesByBucket[bucketKey].push(match);
    });
    
    console.log('Final buckets:', Object.keys(matchesByBucket));
    Object.keys(matchesByBucket).forEach(key => {
        console.log(`  ${key}: ${matchesByBucket[key].length} matches`);
    });
    
    return matchesByBucket;
}

// Calculate statistic for a group of matches (exactly like Android extension)
function calculateStatForGroup(groupMatches, statType) {
    const totalMatches = groupMatches.length;
    let totalGoals = 0;
    let winnerMatches = 0;
    let drawMatches = 0;
    const teamStats = {};
    
    // Calculate basic stats
    groupMatches.forEach(match => {
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        
        totalGoals += homeScore + awayScore;
        
        if (homeScore !== awayScore) {
            winnerMatches++;
        } else {
            drawMatches++;
        }
        
        // Track team stats
        if (!teamStats[match.home_team_id]) {
            teamStats[match.home_team_id] = { goalsFor: 0, goalsAgainst: 0 };
        }
        if (!teamStats[match.away_team_id]) {
            teamStats[match.away_team_id] = { goalsFor: 0, goalsAgainst: 0 };
        }
        
        teamStats[match.home_team_id].goalsFor += homeScore;
        teamStats[match.home_team_id].goalsAgainst += awayScore;
        teamStats[match.away_team_id].goalsFor += awayScore;
        teamStats[match.away_team_id].goalsAgainst += homeScore;
    });
    
    // Return the requested statistic
    switch (statType) {
        case 'total_matches':
            return totalMatches.toString();
            
        case 'total_goals':
            return totalGoals.toString();
            
        case 'goal_rate':
            return totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : '0.00';
            
        case 'winner_matches':
            const winPercent = totalMatches > 0 ? ((winnerMatches / totalMatches) * 100).toFixed(1) : '0.0';
            return `${winnerMatches} (${winPercent}%)`;
            
        case 'draw_matches':
            const drawPercent = totalMatches > 0 ? ((drawMatches / totalMatches) * 100).toFixed(1) : '0.0';
            return `${drawMatches} (${drawPercent}%)`;
            
        case 'strongest_attack':
        case 'weakest_attack':
        case 'strongest_defense':
        case 'weakest_defense':
            return findBestTeams(teamStats, statType, groupMatches);
            
        default:
            return '-';
    }
}

// Find team(s) with best/worst attack/defense (can be multiple teams with same value)
function findBestTeams(teamStats, statType, matches) {
    if (Object.keys(teamStats).length === 0) return '-';
    
    const isAttack = statType.includes('attack');
    const isStrongest = statType.includes('strongest');
    
    // For attack: strongest = most goals scored, weakest = least goals scored
    // For defense: strongest = least goals conceded, weakest = most goals conceded
    let bestValue = (isStrongest && isAttack) || (!isStrongest && !isAttack) ? -1 : 999999;
    const bestTeamIds = [];
    
    // Find best value and all teams with that value
    Object.keys(teamStats).forEach(teamId => {
        const value = isAttack ? teamStats[teamId].goalsFor : teamStats[teamId].goalsAgainst;
        
        // For strongest attack or weakest defense: want higher value
        // For weakest attack or strongest defense: want lower value
        const wantHigher = (isStrongest && isAttack) || (!isStrongest && !isAttack);
        const isBetter = wantHigher ? (value > bestValue) : (value < bestValue);
        
        if (isBetter) {
            bestValue = value;
            bestTeamIds.length = 0;
            bestTeamIds.push(teamId);
        } else if (value === bestValue) {
            bestTeamIds.push(teamId);
        }
    });
    
    if (bestValue === -1 || bestValue === 999999) return '-';
    
    // Get team names
    const teamNames = bestTeamIds.map(teamId => {
        const match = matches.find(m => m.home_team_id === teamId || m.away_team_id === teamId);
        if (match) {
            const teamInfo = getTeamInfo(match, teamId);
            return teamInfo.name;
        }
        return '';
    }).filter(name => name).join(', ');
    
    return teamNames ? `${teamNames} (${bestValue})` : '-';
}

function displayScorers(container) {
    console.log('Processing scorers from', allMatches.length, 'matches');
    
    // Check if competition has groups
    const hasGroups = allMatches.some(match => match.group || match.sector);
    
    // Group matches by sector/group
    const groups = {};
    allMatches.forEach(match => {
        const group = hasGroups 
            ? (match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة'))
            : 'all';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(match);
    });
    
    let html = '';
    let totalMatchesWithScorers = 0;
    
    // Process each group separately
    Object.keys(groups).sort().forEach(groupName => {
        const scorers = {};
        const groupMatches = groups[groupName];
        
        groupMatches.forEach(match => {
            if (match.home_scorers || match.away_scorers) {
                totalMatchesWithScorers++;
            }
            if (match.status !== 'completed') return;
            
            // Process home scorers
            if (match.home_scorers && Array.isArray(match.home_scorers)) {
                const assistMarker = 'صناعة الاهداف';
                const assistIndex = match.home_scorers.findIndex(item => item === assistMarker);
                const goals = assistIndex === -1 ? match.home_scorers : match.home_scorers.slice(0, assistIndex);
                
                goals.forEach(scorer => {
                    if (!scorer || scorer === 'لا يوجد بيانات') return;
                    const parsed = parsePlayerEvent(scorer);
                    const key = `${parsed.name}_${match.home_team_id}`;
                    if (!scorers[key]) {
                        scorers[key] = {
                            name: parsed.name,
                            teamId: match.home_team_id,
                            goals: 0
                        };
                    }
                    scorers[key].goals += parsed.count;
                });
            }
            
            // Process away scorers
            if (match.away_scorers && Array.isArray(match.away_scorers)) {
                const assistMarker = 'صناعة الاهداف';
                const assistIndex = match.away_scorers.findIndex(item => item === assistMarker);
                const goals = assistIndex === -1 ? match.away_scorers : match.away_scorers.slice(0, assistIndex);
                
                goals.forEach(scorer => {
                    if (!scorer || scorer === 'لا يوجد بيانات') return;
                    const parsed = parsePlayerEvent(scorer);
                    const key = `${parsed.name}_${match.away_team_id}`;
                    if (!scorers[key]) {
                        scorers[key] = {
                            name: parsed.name,
                            teamId: match.away_team_id,
                            goals: 0
                        };
                    }
                    scorers[key].goals += parsed.count;
                });
            }
        });
        
        const sortedScorers = Object.values(scorers)
            .filter(s => s.goals > 0)
            .sort((a, b) => b.goals - a.goals);
        
        if (sortedScorers.length > 0) {
            if (hasGroups) {
                html += `<h3 class="group-header">${groupName}</h3>`;
            }
            html += createStatsList(sortedScorers, 'goals', 'الهدافين');
        }
    });
    
    console.log('Total matches with scorers:', totalMatchesWithScorers);
    
    if (html === '') {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
    } else {
        container.innerHTML = html;
    }
}

function displayAssists(container) {
    console.log('displayAssists - Processing assists from', allMatches.length, 'matches');
    
    // Check if competition has groups
    const hasGroups = allMatches.some(match => match.group || match.sector);
    
    // Group matches by sector/group
    const groups = {};
    allMatches.forEach(match => {
        const group = hasGroups 
            ? (match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة'))
            : 'all';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(match);
    });
    
    let html = '';
    let totalMatchesWithAssists = 0;
    
    // Process each group separately
    Object.keys(groups).sort().forEach(groupName => {
        const assisters = {};
        const groupMatches = groups[groupName];
        
        groupMatches.forEach(match => {
            if (match.status !== 'completed') return;
            
            // Process home assists
            if (match.home_scorers && Array.isArray(match.home_scorers)) {
                const assistMarker = 'صناعة الاهداف';
                const assistIndex = match.home_scorers.findIndex(item => item === assistMarker);
                
                if (assistIndex !== -1 && assistIndex < match.home_scorers.length - 1) {
                    const assists = match.home_scorers.slice(assistIndex + 1);
                    totalMatchesWithAssists++;
                    
                    assists.forEach(assister => {
                        if (!assister || assister === 'لا يوجد بيانات' || assister.trim() === '') return;
                        
                        const parsed = parsePlayerEvent(assister);
                        const key = `${parsed.name}_${match.home_team_id}`;
                        if (!assisters[key]) {
                            assisters[key] = {
                                name: parsed.name,
                                teamId: match.home_team_id,
                                assists: 0
                            };
                        }
                        assisters[key].assists += parsed.count;
                    });
                }
            }
            
            // Process away assists
            if (match.away_scorers && Array.isArray(match.away_scorers)) {
                const assistMarker = 'صناعة الاهداف';
                const assistIndex = match.away_scorers.findIndex(item => item === assistMarker);
                
                if (assistIndex !== -1 && assistIndex < match.away_scorers.length - 1) {
                    const assists = match.away_scorers.slice(assistIndex + 1);
                    
                    assists.forEach(assister => {
                        if (!assister || assister === 'لا يوجد بيانات' || assister.trim() === '') return;
                        
                        const parsed = parsePlayerEvent(assister);
                        const key = `${parsed.name}_${match.away_team_id}`;
                        if (!assisters[key]) {
                            assisters[key] = {
                                name: parsed.name,
                                teamId: match.away_team_id,
                                assists: 0
                            };
                        }
                        assisters[key].assists += parsed.count;
                    });
                }
            }
        });
        
        const sortedAssisters = Object.values(assisters)
            .filter(a => a.assists > 0)
            .sort((a, b) => b.assists - a.assists);
        
        console.log(`Group ${groupName}: Found ${sortedAssisters.length} assisters`);
        
        if (sortedAssisters.length > 0) {
            if (hasGroups) {
                html += `<h3 class="group-header">${groupName}</h3>`;
            }
            html += createStatsList(sortedAssisters, 'assists', 'صناعة الأهداف');
        }
    });
    
    console.log('Total matches with assists marker:', totalMatchesWithAssists);
    console.log('Total HTML output:', html.length > 0 ? 'Has content' : 'Empty');
    
    if (html === '') {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
    } else {
        container.innerHTML = html;
    }
}

function displayCleanSheets(container) {
    // Check if competition has groups
    const hasGroups = allMatches.some(match => match.group || match.sector);
    
    // Group matches by sector/group
    const groups = {};
    allMatches.forEach(match => {
        const group = hasGroups 
            ? (match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة'))
            : 'all';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(match);
    });
    
    let html = '';
    
    // Process each group separately
    Object.keys(groups).sort().forEach(groupName => {
        const keepers = {};
        const groupMatches = groups[groupName];
        
        groupMatches.forEach(match => {
            if (match.status !== 'completed') return;
            
            // Home team clean sheet
            if (match.away_score === 0) {
                const teamInfo = getTeamInfo(match, match.home_team_id);
                const key = match.home_team_id;
                if (!keepers[key]) {
                    keepers[key] = {
                        name: teamInfo.name,
                        teamId: match.home_team_id,
                        cleanSheets: 0
                    };
                }
                keepers[key].cleanSheets++;
            }
            
            // Away team clean sheet
            if (match.home_score === 0) {
                const teamInfo = getTeamInfo(match, match.away_team_id);
                const key = match.away_team_id;
                if (!keepers[key]) {
                    keepers[key] = {
                        name: teamInfo.name,
                        teamId: match.away_team_id,
                        cleanSheets: 0
                    };
                }
                keepers[key].cleanSheets++;
            }
        });
        
        const sortedKeepers = Object.values(keepers)
            .filter(k => k.cleanSheets > 0)
            .sort((a, b) => b.cleanSheets - a.cleanSheets);
        
        if (sortedKeepers.length > 0) {
            if (hasGroups) {
                html += `<h3 class="group-header">${groupName}</h3>`;
            }
            html += createStatsList(sortedKeepers, 'cleanSheets', 'الشباك النظيفة');
        }
    });
    
    if (html === '') {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
    } else {
        container.innerHTML = html;
    }
}

function parsePlayerEvent(eventString) {
    const match = eventString.match(/^(.*?)\s*\((\d+)\)$/);
    if (match) {
        return { name: match[1].trim(), count: parseInt(match[2]) };
    }
    return { name: eventString.trim(), count: 1 };
}

function createStatsList(data, valueKey, title) {
    if (data.length === 0) {
        return '<div class="no-data">لا توجد بيانات</div>';
    }
    
    let html = '<div class="stats-list">';
    html += `<div class="stats-header"><span>اللاعب / الفريق</span><span>${title}</span></div>`;
    
    data.forEach(item => {
        // Find any match with this team to get team info
        const matchWithTeam = allMatches.find(m => 
            m.home_team_id === item.teamId || m.away_team_id === item.teamId
        );
        const teamInfo = matchWithTeam ? getTeamInfo(matchWithTeam, item.teamId) : { name: 'فريق غير معروف', logo: null };
        
        html += `
            <div class="stats-item">
                <div class="stats-player-info">
                    <div class="stats-player-name">${item.name}</div>
                    <div class="stats-team-name">${teamInfo.name}</div>
                </div>
                <div class="stats-value">${item[valueKey]}</div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// ==================== TEAMS ====================
function displayTeams() {
    const container = document.getElementById('teams-container');
    
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    // Check if competition has groups
    const hasGroups = allMatches.some(match => match.group || match.sector);
    
    // Group teams by sector/group
    const groups = {};
    allMatches.forEach(match => {
        const group = hasGroups 
            ? (match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة'))
            : 'all';
        if (!groups[group]) {
            groups[group] = new Set();
        }
        groups[group].add(match.home_team_id);
        groups[group].add(match.away_team_id);
    });
    
    let html = '';
    
    // Process each group separately
    Object.keys(groups).sort().forEach(groupName => {
        const teamIds = Array.from(groups[groupName]);
        
        const teams = teamIds.map(teamId => {
            const matchWithTeam = allMatches.find(m => 
                m.home_team_id === teamId || m.away_team_id === teamId
            );
            const teamInfo = matchWithTeam ? getTeamInfo(matchWithTeam, teamId) : { name: 'فريق غير معروف', logo: null };
            return { ...teamInfo, teamId };
        })
        .filter(team => team.name !== 'فريق غير معروف') // Filter out unknown teams
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        
        if (teams.length > 0) {
            if (hasGroups) {
                html += `<h3 class="group-header">${groupName}</h3>`;
            }
            html += '<div class="teams-grid">';
            teams.forEach(team => {
                html += `
                    <div class="team-card" onclick="showTeamDetails('${team.teamId}')">
                        ${team.logo ? `<img src="${team.logo}" class="team-card-logo" alt="${team.name}">` : ''}
                        <div class="team-card-name">${team.name}</div>
                    </div>
                `;
            });
            html += '</div>';
        }
    });
    
    if (html === '') {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
    } else {
        container.innerHTML = html;
    }
}

function showTeamDetails(teamId) {
    console.log('showTeamDetails called with teamId:', teamId);
    console.log('allMatches length:', allMatches.length);
    
    const teamDetailsPage = document.getElementById('team-details-page');
    const titleElement = document.getElementById('team-title');
    const headerContainer = document.getElementById('team-header-container');
    const infoContainer = document.getElementById('team-info-container');
    const playersContainer = document.getElementById('team-players-container');
    const matchesContainer = document.getElementById('team-matches-container');
    
    if (!teamDetailsPage) {
        console.error('team-details-page element not found');
        return;
    }
    
    // Find team info from matches
    const matchWithTeam = allMatches.find(m => 
        m.home_team_id === teamId || m.away_team_id === teamId
    );
    
    console.log('matchWithTeam found:', matchWithTeam ? 'yes' : 'no');
    
    if (!matchWithTeam) {
        alert('لم يتم العثور على بيانات الفريق');
        return;
    }
    
    const teamInfo = getTeamInfo(matchWithTeam, teamId);
    const teamData = matchWithTeam.teams.find(t => 
        t.team_id === teamId || t.teamId === teamId || t.id === teamId
    );
    
    // Set title - empty to hide it beside back button
    titleElement.textContent = '';
    
    // Display team header
    headerContainer.innerHTML = `
        <div class="team-details-header">
            ${teamInfo.logo ? `<img src="${teamInfo.logo}" class="team-details-logo" alt="${teamInfo.name}">` : ''}
            <div class="team-details-info">
                <h1>${teamInfo.name}</h1>
            </div>
        </div>
    `;
    
    // Display team info in collapsible section
    displayTeamInfo(teamData, infoContainer);
    
    // Set current team ID for statistics
    currentTeamId = teamId;
    
    // Initialize team statistics (show scorers by default)
    const statsContainer = document.getElementById('team-stats-container');
    if (statsContainer) {
        displayTeamScorers(statsContainer, teamId);
    }
    
    // Display players/staff
    displayTeamPlayers(teamData, playersContainer);
    
    // Display team matches
    displayTeamMatches(teamId, teamInfo.name, matchesContainer);
    
    // Show page
    showPage('team-details');
}

function displayTeamInfo(teamData, container) {
    if (!teamData) {
        container.innerHTML = '<div class="no-data">لا توجد معلومات عن الفريق</div>';
        return;
    }
    
    let infoHtml = '<div class="team-info-list">';
    
    // City
    if (teamData.city) {
        infoHtml += `
            <div class="info-row">
                <div class="info-label">📍 المدينة</div>
                <div class="info-value">${teamData.city}</div>
            </div>
        `;
    }
    
    // Field (with optional link)
    if (teamData.field) {
        const fieldValue = teamData.fieldurl 
            ? `<a href="${teamData.fieldurl}" target="_blank" class="field-link">${teamData.field}</a>`
            : teamData.field;
        infoHtml += `
            <div class="info-row">
                <div class="info-label">🏟️ الملعب</div>
                <div class="info-value">${fieldValue}</div>
            </div>
        `;
    }
    
    // Information
    if (teamData.information) {
        const formattedInfo = teamData.information.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
        infoHtml += `
            <div class="info-row">
                <div class="info-label">ℹ️ معلومات</div>
                <div class="info-value">${formattedInfo}</div>
            </div>
        `;
    }
    
    // Group (if exists)
    if (teamData.group) {
        infoHtml += `
            <div class="info-row">
                <div class="info-label">📋 المجموعة</div>
                <div class="info-value">${teamData.group}</div>
            </div>
        `;
    }
    
    infoHtml += '</div>';
    container.innerHTML = infoHtml;
}

function displayTeamPlayers(teamData, container) {
    if (!teamData || !teamData.players) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات اللاعبين</div>';
        return;
    }
    
    let html = '<div class="team-players-list">';
    
    const players = teamData.players;
    
    // Coach
    if (players.coach && players.coach.length > 0) {
        html += '<div class="players-category">';
        html += '<h4>👔 الجهاز الفني</h4>';
        html += '<ul class="players-list">';
        players.coach.forEach(coach => {
            html += `<li>${coach}</li>`;
        });
        html += '</ul></div>';
    }
    
    // Goalkeepers
    if (players.goalkeepers && players.goalkeepers.length > 0) {
        html += '<div class="players-category">';
        html += '<h4>🧤 حراس المرمى</h4>';
        html += '<ul class="players-list">';
        players.goalkeepers.forEach(player => {
            html += `<li>${player}</li>`;
        });
        html += '</ul></div>';
    }
    
    // Defenders
    if (players.defenders && players.defenders.length > 0) {
        html += '<div class="players-category">';
        html += '<h4>🛡️ المدافعون</h4>';
        html += '<ul class="players-list">';
        players.defenders.forEach(player => {
            html += `<li>${player}</li>`;
        });
        html += '</ul></div>';
    }
    
    // Midfielders
    if (players.midfielders && players.midfielders.length > 0) {
        html += '<div class="players-category">';
        html += '<h4>⚙️ لاعبو الوسط</h4>';
        html += '<ul class="players-list">';
        players.midfielders.forEach(player => {
            html += `<li>${player}</li>`;
        });
        html += '</ul></div>';
    }
    
    // Attackers
    if (players.attackers && players.attackers.length > 0) {
        html += '<div class="players-category">';
        html += '<h4>⚡ المهاجمون</h4>';
        html += '<ul class="players-list">';
        players.attackers.forEach(player => {
            html += `<li>${player}</li>`;
        });
        html += '</ul></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function displayTeamMatches(teamId, teamName, container) {
    // Filter matches for this team
    const teamMatches = allMatches.filter(m => 
        m.home_team_id === teamId || m.away_team_id === teamId
    );
    
    if (teamMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات</div>';
        return;
    }
    
    // Group matches by date and week
    const dateGroups = {};
    teamMatches.forEach(match => {
        const date = match.date || 'غير محدد';
        const week = match.week || 'غير محدد';
        
        if (!dateGroups[date]) {
            dateGroups[date] = {};
        }
        
        if (!dateGroups[date][week]) {
            dateGroups[date][week] = [];
        }
        
        dateGroups[date][week].push(match);
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort((a, b) => {
        if (a === 'غير محدد') return 1;
        if (b === 'غير محدد') return -1;
        return new Date(a) - new Date(b);
    });
    
    // Clear container and create main section
    container.innerHTML = '';
    const mainSection = document.createElement('div');
    mainSection.className = 'team-matches-list';
    
    sortedDates.forEach(date => {
        const weeksInDate = Object.keys(dateGroups[date]);
        
        weeksInDate.forEach(week => {
            const weekSection = document.createElement('div');
            weekSection.className = 'week-section';
            
            const sectorContainer = document.createElement('div');
            sectorContainer.className = 'sector-container';
            
            const firstMatch = dateGroups[date][week][0];
            const dateInfo = formatArabicDate(new Date(date));
            
            const sectorHeader = document.createElement('div');
            sectorHeader.className = 'sector-header';
            sectorHeader.innerHTML = `
                <div class="sector-header-content">
                    <h3 class="sector-number">${week === 'غير محدد' ? week : `الأسبوع ${week}`}</h3>
                    <span class="sector-date">${dateInfo}</span>
                </div>
            `;
            sectorContainer.appendChild(sectorHeader);
            
            const matchesGrid = document.createElement('div');
            matchesGrid.className = 'matches-grid';
            
            dateGroups[date][week].forEach(match => {
                const card = createMatchCard(match, true);
                matchesGrid.appendChild(card);
            });
            
            sectorContainer.appendChild(matchesGrid);
            weekSection.appendChild(sectorContainer);
            mainSection.appendChild(weekSection);
        });
    });
    
    container.appendChild(mainSection);
}

// ===== TEAM-SPECIFIC STATISTICS =====
let currentTeamId = null;

function showTeamStats(statType) {
    // Update active button
    document.querySelectorAll('.stats-tabs .stats-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const container = document.getElementById('team-stats-container');
    container.innerHTML = '<div class="loading"><div class="loader"></div><p>جاري التحميل...</p></div>';
    
    if (!currentTeamId || !allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    if (statType === 'scorers') {
        displayTeamScorers(container, currentTeamId);
    } else if (statType === 'assists') {
        displayTeamAssists(container, currentTeamId);
    }
}

function displayTeamScorers(container, teamId) {
    const scorersMap = {};
    
    allMatches.forEach(match => {
        if (match.status !== 'completed') return;
        
        // Process home team goals
        if (match.home_team_id === teamId && match.home_scorers && Array.isArray(match.home_scorers)) {
            const assistMarker = 'صناعة الاهداف';
            const assistIndex = match.home_scorers.findIndex(item => item === assistMarker || item === 'Assists');
            const goals = assistIndex === -1 ? match.home_scorers : match.home_scorers.slice(0, assistIndex);
            
            goals.forEach(scorer => {
                if (!scorer || scorer === 'لا يوجد بيانات' || scorer.trim() === '') return;
                
                // Parse player name and goal count
                const match_result = scorer.match(/^(.+?)\s*\((\d+)\)$/);
                if (match_result) {
                    const playerName = match_result[1].trim();
                    const goalCount = parseInt(match_result[2]);
                    scorersMap[playerName] = (scorersMap[playerName] || 0) + goalCount;
                } else {
                    scorersMap[scorer.trim()] = (scorersMap[scorer.trim()] || 0) + 1;
                }
            });
        }
        
        // Process away team goals
        if (match.away_team_id === teamId && match.away_scorers && Array.isArray(match.away_scorers)) {
            const assistMarker = 'صناعة الاهداف';
            const assistIndex = match.away_scorers.findIndex(item => item === assistMarker || item === 'Assists');
            const goals = assistIndex === -1 ? match.away_scorers : match.away_scorers.slice(0, assistIndex);
            
            goals.forEach(scorer => {
                if (!scorer || scorer === 'لا يوجد بيانات' || scorer.trim() === '') return;
                
                // Parse player name and goal count
                const match_result = scorer.match(/^(.+?)\s*\((\d+)\)$/);
                if (match_result) {
                    const playerName = match_result[1].trim();
                    const goalCount = parseInt(match_result[2]);
                    scorersMap[playerName] = (scorersMap[playerName] || 0) + goalCount;
                } else {
                    scorersMap[scorer.trim()] = (scorersMap[scorer.trim()] || 0) + 1;
                }
            });
        }
    });
    
    // Sort by goals
    const sortedScorers = Object.entries(scorersMap)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedScorers.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    let html = '<div class="stats-list">';
    sortedScorers.forEach(([player, goals], index) => {
        html += `
            <div class="stat-row">
                <div class="stat-rank">${index + 1}</div>
                <div class="stat-name">${player}</div>
                <div class="stat-value">${goals}</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function displayTeamAssists(container, teamId) {
    const assistsMap = {};
    
    allMatches.forEach(match => {
        if (match.status !== 'completed') return;
        
        // Process home team assists
        if (match.home_team_id === teamId && match.home_scorers && Array.isArray(match.home_scorers)) {
            const assistMarker = match.home_scorers.findIndex(item => item === 'صناعة الاهداف' || item === 'Assists');
            if (assistMarker !== -1 && assistMarker < match.home_scorers.length - 1) {
                const assists = match.home_scorers.slice(assistMarker + 1);
                assists.forEach(assister => {
                    if (!assister || assister === 'لا يوجد بيانات' || assister.trim() === '') return;
                    
                    // Parse player name and assist count
                    const match_result = assister.match(/^(.+?)\s*\((\d+)\)$/);
                    if (match_result) {
                        const playerName = match_result[1].trim();
                        const assistCount = parseInt(match_result[2]);
                        assistsMap[playerName] = (assistsMap[playerName] || 0) + assistCount;
                    } else {
                        assistsMap[assister.trim()] = (assistsMap[assister.trim()] || 0) + 1;
                    }
                });
            }
        }
        
        // Process away team assists
        if (match.away_team_id === teamId && match.away_scorers && Array.isArray(match.away_scorers)) {
            const assistMarker = match.away_scorers.findIndex(item => item === 'صناعة الاهداف' || item === 'Assists');
            if (assistMarker !== -1 && assistMarker < match.away_scorers.length - 1) {
                const assists = match.away_scorers.slice(assistMarker + 1);
                assists.forEach(assister => {
                    if (!assister || assister === 'لا يوجد بيانات' || assister.trim() === '') return;
                    
                    // Parse player name and assist count
                    const match_result = assister.match(/^(.+?)\s*\((\d+)\)$/);
                    if (match_result) {
                        const playerName = match_result[1].trim();
                        const assistCount = parseInt(match_result[2]);
                        assistsMap[playerName] = (assistsMap[playerName] || 0) + assistCount;
                    } else {
                        assistsMap[assister.trim()] = (assistsMap[assister.trim()] || 0) + 1;
                    }
                });
            }
        }
    });
    
    // Sort by assists
    const sortedAssisters = Object.entries(assistsMap)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedAssisters.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    let html = '<div class="stats-list">';
    sortedAssisters.forEach(([player, assists], index) => {
        html += `
            <div class="stat-row">
                <div class="stat-rank">${index + 1}</div>
                <div class="stat-name">${player}</div>
                <div class="stat-value">${assists}</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// ===== STAGE FILTERING FOR STANDINGS =====
let currentStageFilter = 'all';

function populateStageFilter() {
    const stageSelect = document.getElementById('stage-select');
    if (!stageSelect || !allMatches || allMatches.length === 0) return;
    
    // Get unique stages
    const stages = new Set();
    allMatches.forEach(match => {
        if (match.stage) {
            stages.add(match.stage);
        }
    });
    
    // Clear existing options except "all"
    stageSelect.innerHTML = '<option value="all">جميع المراحل</option>';
    
    // Add stage options
    Array.from(stages).sort().forEach(stage => {
        const option = document.createElement('option');
        option.value = stage;
        option.textContent = stage;
        stageSelect.appendChild(option);
    });
    
    // Reset to "all"
    stageSelect.value = 'all';
    currentStageFilter = 'all';
}

function filterStandingsByStage() {
    const stageSelect = document.getElementById('stage-select');
    currentStageFilter = stageSelect.value;
    
    const container = document.getElementById('standings-container');
    container.innerHTML = '<div class="loading"><div class="loader"></div><p>جاري التحميل...</p></div>';
    
    // Re-display standings with filter
    displayStandingsWithStageFilter(container);
}

function displayStandingsWithStageFilter(container) {
    if (!allMatches || allMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
        return;
    }
    
    // Filter matches by stage
    let filteredMatches = allMatches;
    if (currentStageFilter !== 'all') {
        filteredMatches = allMatches.filter(match => match.stage === currentStageFilter);
    }
    
    if (filteredMatches.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد مباريات في هذه المرحلة</div>';
        return;
    }
    
    // Check if competition has groups
    const hasGroups = filteredMatches.some(match => match.group || match.sector);
    
    // Group teams by sector/group
    const groups = {};
    filteredMatches.forEach(match => {
        const group = hasGroups 
            ? (match.group ? `المجموعة ${match.group}` : (match.sector || 'بدون مجموعة'))
            : 'all';
        if (!groups[group]) {
            groups[group] = new Set();
        }
        groups[group].add(match.home_team_id);
        groups[group].add(match.away_team_id);
    });
    
    container.innerHTML = '';
    
    // Calculate standings for each group using filtered matches
    Object.keys(groups).sort().forEach(groupName => {
        const teamIds = Array.from(groups[groupName]);
        const standings = calculateStandingsWithMatches(teamIds, filteredMatches);
        
        if (hasGroups && groupName !== 'بدون مجموعة') {
            const groupHeader = document.createElement('h3');
            groupHeader.textContent = groupName;
            groupHeader.style.cssText = 'background: #f0f0f0; padding: 15px 20px; margin: 20px 0 10px 0; border-radius: 10px; text-align: center; color: #7e0000;';
            container.appendChild(groupHeader);
        }
        
        container.appendChild(createStandingsTable(standings));
    });
}

function calculateStandingsWithMatches(teamIds, matches) {
    const standings = {};
    
    // Initialize standings for each team
    teamIds.forEach(teamId => {
        standings[teamId] = {
            teamId: teamId,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0
        };
    });
    
    // Calculate stats from filtered matches
    matches.forEach(match => {
        if (match.status !== 'completed') return;
        
        const homeId = match.home_team_id;
        const awayId = match.away_team_id;
        
        if (!standings[homeId] || !standings[awayId]) return;
        
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        
        standings[homeId].played++;
        standings[awayId].played++;
        standings[homeId].goalsFor += homeScore;
        standings[homeId].goalsAgainst += awayScore;
        standings[awayId].goalsFor += awayScore;
        standings[awayId].goalsAgainst += homeScore;
        
        if (homeScore > awayScore) {
            standings[homeId].won++;
            standings[homeId].points += 3;
            standings[awayId].lost++;
        } else if (awayScore > homeScore) {
            standings[awayId].won++;
            standings[awayId].points += 3;
            standings[homeId].lost++;
        } else {
            standings[homeId].drawn++;
            standings[awayId].drawn++;
            standings[homeId].points++;
            standings[awayId].points++;
        }
    });
    
    // Calculate goal difference and sort
    Object.values(standings).forEach(team => {
        team.goalDiff = team.goalsFor - team.goalsAgainst;
    });
    
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return 0;
    });
}
