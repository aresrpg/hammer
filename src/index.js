import Anvil from 'prismarine-provider-anvil'
import minecraftData from 'minecraft-data'
import fs from 'fs'

function fix_missing_states(block, type) {
  if (type.Properties) {
    const properties = type.Properties.value

    for (const state of block.states) {
      if (!(state.name in properties)) {
        console.log('\t', state.name, 'state missing')
        switch (state.name) {
          case 'waterlogged':
            properties.waterlogged = { type: 'string', value: 'false' }
            break
          case 'powered':
            properties.powered = { type: 'string', value: 'false' }
            break
          default:
            throw new Error(`"${state.name}" unsupported`)
        }
      }
    }
  }
}

// FIXME: we should look if we have a block on top before setting up property
function fix_cobblestone_wall(block, type) {
  if (type.Properties) {
    const properties = type.Properties.value

    if (block.name === 'cobblestone_wall') {
      console.log('\t', 'Forcing property up of cobblestone_wall')
      properties.up = { type: 'string', value: 'true' }
    }
  }
}

const palette_fixes = [fix_missing_states, fix_cobblestone_wall]

function fix_palette(mcData, raw) {
  const sections = raw.value.Level.value.Sections

  if (sections.type === 'longArray' && sections.value.length === 0) return

  for (const section of sections.value.value) {
    const palette = section.Palette
    if (section.Palette) {
      for (const type of palette.value.value) {
        const name = type.Name.value.split(':')[1]
        const block = mcData.blocksByName[name]

        for (const fix of palette_fixes) fix(block, type)
      }
    }
  }
}

export function fix_chunk(mcData, chunk) {
  fix_palette(mcData, chunk)
}

export async function fix_region(mcData, world, region) {
  for (let x = region.x * 32; x < (region.x + 1) * 32; x++) {
    for (let z = region.z * 32; z < (region.z + 1) * 32; z++) {
      const chunk = await world.loadRaw(x, z)
      if (chunk) {
        fix_chunk(mcData, chunk)
        await world.saveRaw(x, z, chunk)
      }
    }
  }
}

export default async function hammer({ region_folder, version }) {
  const AnvilWorld = Anvil.Anvil(version)
  const mcData = minecraftData(version)

  const world = new AnvilWorld(region_folder)

  const regions = (await fs.promises.readdir(region_folder))
    .filter((file) => file.startsWith('r.') && file.endsWith('.mca'))
    .map((file) => {
      const [, x, z] = file.split('.')
      return { x: +x, z: +z }
    })

  for (const [i, region] of regions.entries()) {
    console.log('Fixing region', region, `${i}/${regions.length}`)
    await fix_region(mcData, world, region)
  }
}

const [region_folder, version] = process.argv.slice(2)
hammer({ region_folder, version })
