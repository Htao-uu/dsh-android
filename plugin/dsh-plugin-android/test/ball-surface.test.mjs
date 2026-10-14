/**
 * The floating ball's host half, driven with a fake Cordis context.
 *
 * The ball's thread is the one place a prompt reaches a user who has no DSH GUI
 * in front of them, so the two GUI-only escape hatches are removed structurally
 * rather than requested in prose:
 *
 *   - `ask_user_question` / `request_user_input` are filtered out of the tool
 *     assembly for that session (and only that session);
 *   - the session's permission preset is pinned, so no approval card can block
 *     a task the user cannot confirm.
 *
 * The prompt section is registered globally but renders empty for every other
 * session (the registry drops empty sections), so a normal DSH session keeps
 * its cards and its `ask` policy.
 *
 * Run: node ball-surface.test.mjs
 */

import { apply } from '../lib/index.js';

const sections = [];
const listeners = new Map();
const logs = [];
const ctx = {
	logger: {
		info: (...args) => logs.push(['info', ...args]),
		warn: (...args) => logs.push(['warn', ...args]),
	},
	sessionProjections: {
		stateOf: (session, key) => (key === 'title' ? session.__title : undefined),
	},
	on(name, handler, options) {
		listeners.set(name, { handler, options });
	},
	inject(_services, callback) {
		callback({
			systemPrompt: {
				getSectionOrder: () => 10100,
				section: (definition) => sections.push(definition),
			},
			permissionPresets: {
				set: (session, name) => {
					session.__permission = name;
				},
			},
			shellEnv: { register: () => {} },
		});
	},
};

// `diagFile: ''` keeps a test run out of the device's own diagnostic file.
apply(ctx, { diagFile: '' });

const ball = { header: { id: 'session-ball-a', agentPreset: 'standard' }, __title: '悬浮球' };
const legacy = { header: { id: 'session-legacy', agentPreset: 'standard' }, __title: '悬浮球' };
const byPreset = { header: { id: 'session-preset', agentPreset: 'ball' }, __title: '随便什么' };
const normal = { header: { id: 'session-normal', agentPreset: 'standard' }, __title: '远程登录并打开程序设计基础' };

let failures = 0;
function check(label, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (!ok) failures += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(actual)}`);
}

const ballSection = sections.find((section) => section.name === 'app:ball-surface');
const androidSection = sections.find((section) => section.name === 'app:android-surface');
const assemble = listeners.get('system-prompt/assemble');

check('both prompt sections are registered', sections.map((s) => s.name).sort(), ['app:android-surface', 'app:ball-surface']);
check('android surface keeps its slot', androidSection.order, 10150);
check('ball surface sorts after android surface and the summarizer hint', ballSection.order, 10165);

const ballText = ballSection.text({ agent: { session: ball } });
check('ball prompt is contributed for a ball session', ballText.length > 100, true);
check('ball prompt names the skill to load', /floating-ball/.test(ballText), true);
check('ball prompt requires numbered options', /编号选项/.test(ballText), true);
check('ball prompt states the pinned permission', /danger-full-access/.test(ballText), true);
check('ball prompt carries no prompt-variable brace', ballText.includes('{{'), false);
check('normal session renders an empty section (dropped by the registry)', ballSection.text({ agent: { session: normal } }), '');
check('no context renders nothing', ballSection.text(undefined), '');

const toolNames = ['bash', 'ask_user_question', 'read', 'request_user_input'];
async function assembleFor(session) {
	return assemble.handler(
		{ tools: toolNames.map((name) => ({ name })) },
		{ agent: { session } },
		async () => ({ tools: toolNames.map((name) => ({ name })) }),
	);
}

check('ball session loses the GUI question tools', (await assembleFor(ball)).tools.map((t) => t.name), ['bash', 'read']);
check('ball session permission is pinned', ball.__permission, 'danger-full-access');
check('a legacy ball session is recognised by its title alone', (await assembleFor(legacy)).tools.map((t) => t.name), ['bash', 'read']);
check('a preset-marked session is recognised too', (await assembleFor(byPreset)).tools.map((t) => t.name), ['bash', 'read']);
const normalResult = await assembleFor(normal);
check('a normal session keeps every tool', normalResult.tools.map((t) => t.name), toolNames);
check('a normal session keeps its own permission preset', normal.__permission, undefined);
check('the assembly filter is registered globally', assemble.options?.global, true);
check('an assembly without tools is left alone', (await assemble.handler({}, { agent: { session: ball } }, async () => ({}))), {});
const broken = {
	header: { id: 'session-broken' },
	get __title() {
		throw new Error('boom');
	},
};
const brokenResult = await assemble.handler(
	{ tools: toolNames.map((name) => ({ name })) },
	{ agent: { session: broken } },
	async () => ({ tools: toolNames.map((name) => ({ name })) }),
);
check('a throwing projection never breaks the assembly', brokenResult.tools.length, 4);
check('each ball session is pinned once', logs.filter(([level]) => level === 'info').length >= 2, true);

// A teammate spawned by the ball: its session has no ball title, but its parent
// does. It must lose the GUI tools (its question is just as unanswerable, and
// the parent waits on it) while keeping its own prompt.
const mate = { header: { id: 'session-mate', agentPreset: 'standard', parentSession: 'session-ball-a' }, __title: '子会话' };
check('a teammate of a ball session loses the GUI tools too', (await assembleFor(mate)).tools.map((t) => t.name), ['bash', 'read']);
check('a teammate of a ball session gets no ball prompt', ballSection.text({ agent: { session: mate } }), '');
const mateOfNormal = { header: { id: 'session-mate-2', agentPreset: 'standard', parentSession: 'session-normal' }, __title: '子会话' };
check('a teammate of a normal session keeps every tool', (await assembleFor(mateOfNormal)).tools.map((t) => t.name), toolNames);
check('a teammate of a normal session gets no ball prompt', ballSection.text({ agent: { session: mateOfNormal } }), '');

// The path a *new* ball thread takes: the client renames it right after
// creating it, so the title arrives as an event — no warm projection needed.
const renamed = { header: { id: 'session-renamed', agentPreset: 'standard' }, __title: '' };
listeners.get('session/event').handler(renamed, { type: 'session/title', data: { title: '悬浮球', source: { kind: 'user' } } });
check('a user title event marks the session without any projection', (await assembleFor(renamed)).tools.map((t) => t.name), ['bash', 'read']);
check('the event-marked session gets the ball prompt', ballSection.text({ agent: { session: renamed } }).length > 100, true);
check('another title does not mark a session', (await assembleFor({ header: { id: 'session-other' }, __title: '别的' })).tools.map((t) => t.name), toolNames);

console.log(failures === 0 ? '\nall ball-surface checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
