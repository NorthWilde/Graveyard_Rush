# Development Process · Graveyard Rush: Midnight Watch

## 1. Starting Point and Intention

I wanted to create a small browser game with understandable rules and satisfying feedback. Rather than writing a detailed story, I focused on controls, player decisions and replayability.

I initially explored a music-based stacking game. After trying the idea, I felt that its timing-based interaction offered too little variety, so I changed direction to automatic shooting and numerical upgrades.

My goal was to let players learn the controls quickly while experiencing both increasing power and growing pressure from enemies.

## 2. Defining the Main Interaction

I chose automatic shooting so that players could concentrate on movement and target selection.

I first considered keyboard controls, then changed to mouse and touch dragging so that the same interaction could work on computers and phones. Pointer coordinates are converted into canvas coordinates to keep movement consistent when the game area scales down.

The main interaction loop is:

**Observe enemies and supplies → drag to aim → defeat enemies or collect an upgrade → respond to the changing situation.**

## 3. Building a Playable Run

I developed the game in VS Code, adding features in stages and checking each change by saving and refreshing the browser:

1. Draw the player and implement horizontal dragging.
2. Add automatically fired bullets and approaching enemies.
3. Detect overlapping bullet and enemy rectangles.
4. Add enemy health, bullet damage and scoring.
5. Add defense points and a game-over condition.
6. Connect start, pause and restart controls.
7. Add supply choices, progression, audio and combat feedback.

During development, I encountered misplaced braces, repeated function declarations and code inserted into the wrong scope. For example, I once updated the elapsed game time before defining the frame-time difference, which stopped the animation from running. Fixing these problems helped me understand function boundaries and execution order.

## 4. Theme and Visual Direction

The interface originally used a pink-and-blue palette and robot characters. I later changed it to a Halloween zombie-defense setting to better support the shooting and survival mechanics.

The final version uses green, red and black. The player is a Pumpkin Warden wearing a pointed hat and red cloak, while enemies are regular zombies and larger brutes.

I defined the defense bar as the safehouse ward rather than the character's personal health. This explains why enemies cause damage by crossing the bottom boundary, even without touching the player.

The desktop page places the introduction beside the game. On smaller screens, the layout becomes a single column. The game interface remains in English.

## 5. Revising Progression and Supplies

### From Passing Through Gates to Shooting Crates

I initially considered upgrades that players would receive by passing through numerical gates. I changed this so that players must destroy a supply crate to receive its reward.

This makes aiming a decision: time spent shooting a crate is time that cannot be spent stopping a zombie.

### Choosing Between Attack and Defense

Supply pairs offer two rewards:

- **POWER:** increases bullet damage.
- **WARD:** increases maximum ward capacity and restores the same amount.

Only one reward can be collected from each pair. Players must decide whether their current situation calls for faster kills or better protection.

### Improving the Later-Game Rhythm

I wanted the numbers to grow into thousands and tens of thousands, so I added wave-based increases to enemy health, attack and upgrade rewards.

During my own playtesting, I felt that later supply crates became too difficult to break and appeared too frequently. I therefore:

- Increased the supply interval from 6 to 12 seconds.
- Limited the screen to one supply pair at a time.
- Adjusted crate durability using the player's damage when the pair appears.
- Slowed the crates' movement.
- Increased POWER rewards.

Later, I felt the game was too easy, so I increased the proportion of brutes in later waves. I kept the overall enemy spawn interval unchanged to make this adjustment easier to evaluate.

These changes came from my own playtesting and do not replace a trial with another person.

## 6. Feedback and Usability Improvements

To make the results of actions easier to understand, I added:

- Enemy health bars and floating damage numbers.
- Persistent damage and ward statistics.
- Reward text, particles, expanding rings and a dedicated sound for brute kills.
- Ward-damage text and a red border effect when enemies escape.
- A persistent `LOW WARD` warning at 25% ward or below.

I also randomized the left and right positions of POWER and WARD crates. This encourages players to read the rewards rather than always moving toward a fixed side.

For audio, I first added shooting and upgrade sounds, followed by a looping electronic background track. I then separated music and sound-effect controls and added a music-volume slider.

Independent audio channels allow players to reduce or disable the music while keeping useful combat sounds. This also addressed an earlier issue in which shooting could be muted while the upgrade sound remained audible.

## 7. Handling Mistakes and Interruptions

I included responses to ordinary interruptions:

- Switching tabs or leaving the window automatically pauses the game.
- Interrupted touch input releases the active pointer.
- The start button is disabled during a run to prevent repeated starts.
- Restarting clears previous objects and resets the run's statistics.
- The visual game remains playable if audio cannot be enabled.
- Disabling visual effects preserves essential numbers and text.

These choices help the game behave sensibly beyond an uninterrupted play session.


### Trial Setup

- **Date:** To be recorded.
- **Device and browser:** To be recorded.
- **Method:** Ask at least one other person to try the game before explaining the controls or rules.
- **Task:** Start a run, attempt to collect an upgrade, and restart after defeat.

### Observations

- Did the participant discover the dragging controls? To be recorded.
- Did they understand the difference between POWER and WARD? To be recorded.
- Did they understand that only one reward is available per pair? To be recorded.
- Where did they hesitate, make a mistake or request help? To be recorded.
- What did they say about difficulty, sound or mobile controls? To be recorded.

### Design Response

- **Specific observation or feedback:** To be recorded.
- **Change made, or reason for keeping the existing design:** To be recorded.
- **Result of checking the revised version:** To be recorded.

The record should not include the participant's name or personal information.

## 8. AI Assistance and Decisions

I used OpenAI ChatGPT/Codex to discuss gameplay options, generate code and documentation drafts, explain program logic and help diagnose errors.

I directed the game concept, control scheme, visual theme and revision requests. I used incremental checks and playtesting to judge whether the results matched my intentions. Development included both step-by-step code integration and adjustments to generated complete-file versions.

### Suggestion Kept

I retained the choice between attack and defense upgrades. It gives players a trade-off rather than allowing them to collect every reward without consequence.

### Suggestions Changed

I changed the fixed left/right supply layout to random positions. I also revised supply durability and frequency based on my experience of playing, and increased the proportion of brutes later in a run.

These decisions support the same goal: encouraging players to observe the situation and make choices rather than staying in one position and relying on automatic shooting.

## 9. Publication and Reflection

The source is managed on GitHub, and GitHub Pages provides an online version for others to try. The development history should preserve actual changes and commits rather than reconstructing work that did not occur.

This project showed me that adding more features does not necessarily improve gameplay. Whether an upgrade is achievable, feedback is understandable, and audio can be controlled all affect whether someone wants to keep playing.

My next priority is to use observations from a real user trial to refine the experience rather than expanding the feature list.