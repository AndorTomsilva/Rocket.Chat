import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

import { IS_EE } from '../config/constants';
import { Users } from '../fixtures/userStates';
import { OmnichannelUnits } from '../page-objects';
import { createAgent } from '../utils/omnichannel/agents';
import { createDepartment } from '../utils/omnichannel/departments';
import { createMonitor } from '../utils/omnichannel/monitors';
import { createOrUpdateUnit } from '../utils/omnichannel/units';
import { test, expect } from '../utils/test';

test.use({ storageState: Users.admin.state });

test.describe('OC - Manage Units', () => {
	test.skip(!IS_EE, 'OC - Manage Units > Enterprise Edition Only');

	let poOmnichannelUnits: OmnichannelUnits;

	let department: Awaited<ReturnType<typeof createDepartment>>;
	let department2: Awaited<ReturnType<typeof createDepartment>>;

	let agent: Awaited<ReturnType<typeof createAgent>>;

	let monitor: Awaited<ReturnType<typeof createMonitor>>;

	test.beforeAll(async ({ api }) => {
		department = await createDepartment(api);
		department2 = await createDepartment(api);
	});

	test.beforeAll(async ({ api }) => {
		agent = await createAgent(api, 'user2');
	});

	test.beforeAll(async ({ api }) => {
		monitor = await createMonitor(api, 'user2');
	});

	test.afterAll(async () => {
		await department.delete();
		await department2.delete();
		await monitor.delete();
		await agent.delete();
	});

	test.beforeEach(async ({ page }: { page: Page }) => {
		poOmnichannelUnits = new OmnichannelUnits(page);
		await page.goto('/omnichannel');
		await poOmnichannelUnits.sidenav.linkUnits.click();
	});

	test('OC - Manage Units - Create Unit', async ({ page }) => {
		const unitName = faker.string.uuid();

		await test.step('expect correct form default state', async () => {
			await poOmnichannelUnits.btnCreateUnit.click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await expect(poOmnichannelUnits.btnSave).toBeDisabled();
			await expect(poOmnichannelUnits.btnCancel).toBeEnabled();
			await poOmnichannelUnits.btnCancel.click();
			await expect(poOmnichannelUnits.contextualBar).not.toBeVisible();
		});

		await test.step('expect to create new unit', async () => {
			await poOmnichannelUnits.btnCreateUnit.click();
			await poOmnichannelUnits.inputName.fill(unitName);
			await poOmnichannelUnits.selectVisibility('public');
			await poOmnichannelUnits.selectDepartment(department.data);
			await poOmnichannelUnits.selectMonitor('user2');
			await poOmnichannelUnits.btnSave.click();
			await expect(poOmnichannelUnits.contextualBar).not.toBeVisible();

			await test.step('expect unit to have been created', async () => {
				await poOmnichannelUnits.search(unitName);
				await expect(poOmnichannelUnits.findRowByName(unitName)).toBeVisible();
			});
		});

		await test.step('expect to delete unit', async () => {
			await poOmnichannelUnits.btnDeleteByName(unitName).click();
			await expect(poOmnichannelUnits.confirmDeleteModal).toBeVisible();
			await poOmnichannelUnits.btnConfirmDeleteModal.click();
			await expect(poOmnichannelUnits.confirmDeleteModal).not.toBeVisible();
			await expect(page.locator('h3 >> text="No units yet"')).toBeVisible();
		});
	});

	test('OC - Manage Units - Edit unit name', async ({ api, page }) => {
		const unitName = faker.string.uuid();
		const editedUnitName = faker.string.uuid();

		const unit = await test.step('expect to create new unit', async () => {
			const { data: newUnit } = await createOrUpdateUnit(api, {
				name: unitName,
				visibility: 'public',
				monitors: [{ monitorId: monitor.data._id, username: 'user2' }],
				departments: [{ departmentId: department.data._id }],
			});

			return newUnit;
		});

		await page.reload();
		
		await test.step('expect to edit unit', async () => {
			await poOmnichannelUnits.search(unit.name);
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await poOmnichannelUnits.inputName.fill(editedUnitName);
			await poOmnichannelUnits.btnSave.click();
		});

		await test.step('expect unit to have been edited', async () => {
			await expect(poOmnichannelUnits.inputSearch).toBeVisible();
			await poOmnichannelUnits.search(editedUnitName);
			await expect(poOmnichannelUnits.findRowByName(editedUnitName)).toBeVisible();
		});

		await test.step('expect to delete unit', async () => {
			await poOmnichannelUnits.findRowByName(editedUnitName).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();

			await test.step('expect to confirm delete', async () => {
				await poOmnichannelUnits.btnDelete.click();
				await expect(poOmnichannelUnits.confirmDeleteModal).toBeVisible();
				await poOmnichannelUnits.btnConfirmDeleteModal.click();
				await expect(poOmnichannelUnits.confirmDeleteModal).not.toBeVisible();
			});

			await expect(poOmnichannelUnits.contextualBar).not.toBeVisible();
		});
	});

	test('OC - Manage Units - Edit unit departments', async ({ api, page }) => {
		const unit = await test.step('expect to create new unit', async () => {
			const { data: unit } = await createOrUpdateUnit(api, {
				name: faker.string.uuid(),
				visibility: 'public',
				monitors: [{ monitorId: monitor.data._id, username: 'user2' }],
				departments: [{ departmentId: department.data._id }],
			});

			return unit;
		});

		await page.reload();

		await test.step('expect to add unit departments', async () => {
			await poOmnichannelUnits.search(unit.name);
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await poOmnichannelUnits.selectDepartment({ name: department2.data.name, _id: department2.data._id });
			await poOmnichannelUnits.btnSave.click();
		});

		await test.step('expect department to be in the chosen departments list', async () => {
			await poOmnichannelUnits.search(unit.name);
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await expect(page.getByRole('option', { name: department2.data.name })).toBeVisible();
			await poOmnichannelUnits.btnContextualbarClose.click();
		});

		await test.step('expect to remove unit departments', async () => {
			await poOmnichannelUnits.search(unit.name);
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await poOmnichannelUnits.selectDepartment({ name: department2.data.name, _id: department2.data._id });
			await poOmnichannelUnits.selectMonitor('user2');
			await poOmnichannelUnits.btnSave.click();
		});

		await test.step('expect department to not be in the chosen departments list', async () => {
			await poOmnichannelUnits.search(unit.name);
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await expect(page.getByRole('option', { name: department2.data.name })).toBeHidden();
			await poOmnichannelUnits.btnContextualbarClose.click();
		});

		await test.step('expect to delete unit', async () => {
			await poOmnichannelUnits.findRowByName(unit.name).click();
			await expect(poOmnichannelUnits.contextualBar).toBeVisible();
			await test.step('expect to confirm delete', async () => {
				await poOmnichannelUnits.btnDelete.click();
				await expect(poOmnichannelUnits.confirmDeleteModal).toBeVisible();
				await poOmnichannelUnits.btnConfirmDeleteModal.click();
				await expect(poOmnichannelUnits.confirmDeleteModal).not.toBeVisible();
			});

			await expect(poOmnichannelUnits.contextualBar).not.toBeVisible();
		});
	})
});
