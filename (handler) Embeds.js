const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder } = require("discord.js");
const { validate } = require("../Helpers/Flags");
const fs = require("fs");
const path = require("path");

const workingEmbeds = new Map();

async function handleEditEmbed(interaction) {
  if (interaction.customId.startsWith("field_modal_")) return await handleEditFields(interaction);
  if (interaction.customId.startsWith("component_modal_")) return await handleEditComponents(interaction);

  if (!interaction.isModalSubmit()) return;

  const working = workingEmbeds.get(interaction.user.id);
  const { client } = interaction
  if (!working) return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });

  const embed = EmbedBuilder.from(working.message.embeds[0] || {});

  const updates = {
    input_description: (val) => embed.setDescription(val),
    input_title: (val) => embed.setTitle(val),
    input_author_name: (val) => {
      const icon = interaction.fields.getTextInputValue("input_author_icon") || null;
      embed.setAuthor(val ? { name: val, iconURL: icon || undefined } : null);
    },
    input_URL: (val) => embed.setURL(val),
    input_thumbnail: (val) => embed.setThumbnail(val),
    input_image: (val) => embed.setImage(val),
    input_color: (val) => {
      if (val) embed.setColor(val);
    },
    input_footer_text: (val) => {
      const icon = interaction.fields.getTextInputValue("input_footer_icon") || null;
      embed.setFooter(val ? { text: val, iconURL: icon || undefined } : null);
    },
    input_timestamp: (val) => {
      if (val.toLowerCase() === "true") embed.setTimestamp(new Date());
      else if (!isNaN(val)) embed.setTimestamp(Number(val));
      else embed.setTimestamp(null);
    }
  };

  if (interaction.isModalSubmit()) {
    for (const [field, applyUpdate] of Object.entries(updates)) {
      const value = interaction.fields.fields.get(field)?.value;
      if (value !== undefined && value !== null) {
        applyUpdate(value);
      }
    }

    await working.message.edit({ embeds: [embed] });

    workingEmbeds.set(interaction.user.id, {
      ...working,
      embed: embed.toJSON()
    });

    return await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Updated embed!`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }


  await working.message.edit({ embeds: [embed] });

  workingEmbeds.set(interaction.user.id, {
    ...working,
    embed: embed.toJSON()
  });


  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Updated embed!`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });
}

async function handleEditFields(interaction) {
  const { client } = interaction;
  const working = workingEmbeds.get(interaction.user.id);

  if (!working) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  if (interaction.isModalSubmit()) {
    const embed = EmbedBuilder.from(working.message.embeds[0] || {});
    const id = interaction.customId;

    if (id === "field_modal_add") {
      const name = interaction.fields.getTextInputValue("input_field_name");
      const value = interaction.fields.getTextInputValue("input_field_value");
      const inlineRaw = interaction.fields.getTextInputValue("input_field_inline");
      const inline = inlineRaw?.toLowerCase() === "true";

      embed.addFields({ name, value, inline });
    }

    if (id === "field_modal_edit") {
      const index = parseInt(interaction.fields.getTextInputValue("input_field_index"));
      const name = interaction.fields.getTextInputValue("input_field_name");
      const value = interaction.fields.getTextInputValue("input_field_value");
      const inlineRaw = interaction.fields.getTextInputValue("input_field_inline");

      if (!embed.data.fields || !embed.data.fields[index]) {
        return interaction.reply({
          content: `Invalid field index: ${index}`,
          flags: 64,
        });
      }

      const field = embed.data.fields[index];

      if (name) field.name = name;
      if (value) field.value = value;
      if (inlineRaw) field.inline = inlineRaw.toLowerCase() === "true";

      embed.spliceFields(index, 1, field);
    }

    if (id === "field_modal_remove") {
      const index = parseInt(interaction.fields.getTextInputValue("input_field_index"));

      if (!embed.data.fields || !embed.data.fields[index]) {
        return interaction.reply({
          content: `Invalid field index: ${index}`,
          flags: 64,
        });
      }

      embed.spliceFields(index, 1);
    }

    await working.message.edit({ embeds: [embed] });

    working.message.embeds = [embed];
    workingEmbeds.set(interaction.user.id, working);

    return await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Updated embed!`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }


  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("edit_fields_action")
      .setPlaceholder("Choose a field action...")
      .addOptions(
        {
          label: "Add Field",
          value: "add",
          description: "Add a new field to the embed",
        },
        {
          label: "Edit Field",
          value: "edit",
          description: "Edit an existing field by index",
        },
        {
          label: "Remove Field",
          value: "remove",
          description: "Remove a field by index",
        }
      )
  );

  const msg = await interaction.reply({
    components: [menu],
    flags: 64,
    fetchReply: true
  });

  const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id });

  collector.on("collect", async (select) => {
    const choice = select.values[0];

    switch (choice) {
      case "add": {
        const modal = new ModalBuilder()
          .setCustomId("field_modal_add")
          .setTitle("Add Field");

        const nameInput = new TextInputBuilder()
          .setCustomId("input_field_name")
          .setLabel("Field Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const valueInput = new TextInputBuilder()
          .setCustomId("input_field_value")
          .setLabel("Field Value")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const inlineInput = new TextInputBuilder()
          .setCustomId("input_field_inline")
          .setLabel("Inline? (true/false)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        await select.showModal(
          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(valueInput),
            new ActionRowBuilder().addComponents(inlineInput)
          )
        );
        break;
      }

      case "edit": {
        const modal = new ModalBuilder()
          .setCustomId("field_modal_edit")
          .setTitle("Edit Field by Index");

        const indexInput = new TextInputBuilder()
          .setCustomId("input_field_index")
          .setLabel("Field Index (0 = first field)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const nameInput = new TextInputBuilder()
          .setCustomId("input_field_name")
          .setLabel("New Field Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const valueInput = new TextInputBuilder()
          .setCustomId("input_field_value")
          .setLabel("New Field Value")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        const inlineInput = new TextInputBuilder()
          .setCustomId("input_field_inline")
          .setLabel("Inline? (true/false)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        await select.showModal(
          modal.addComponents(
            new ActionRowBuilder().addComponents(indexInput),
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(valueInput),
            new ActionRowBuilder().addComponents(inlineInput)
          )
        );
        break;
      }

      case "remove": {
        const modal = new ModalBuilder()
          .setCustomId("field_modal_remove")
          .setTitle("Remove Field");

        const indexInput = new TextInputBuilder()
          .setCustomId("input_field_index")
          .setLabel("Field Index to Remove")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        await select.showModal(
          modal.addComponents(
            new ActionRowBuilder().addComponents(indexInput)
          )
        );
        break;
      }
    }
  });
}

async function handleEditComponents(interaction) {
  const { client } = interaction

  if (interaction.isModalSubmit()) {
    const working = workingEmbeds.get(interaction.user.id);
    if (!working) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
            .setColor(await client.getColor(interaction.guild.id))
        ],
        flags: 64
      });
    }

    const components = working.message.components || [];

    switch (interaction.customId) {
      case "component_modal_add_button": {
        const styleRaw = interaction.fields.getTextInputValue("input_button_style");
        const emoji = interaction.fields.getTextInputValue("input_button_emoji");
        const embedId = interaction.fields.getTextInputValue("input_button_embed");
        const label = interaction.fields.getTextInputValue("input_button_label");

        const style = parseInt(styleRaw);
        if (![1, 2, 3, 4, 5].includes(style)) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid Style`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        }

        if (style === 5 && !/^https?:\/\//i.test(embedId)) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid URL for Link Button`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        }

        if (style !== 5) {
          const conflict = working.message.components.some(row =>
            row.components.some(c => (c.custom_id || c.customId) === embedId)
          );
          if (conflict) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: ID already exists`)
                  .setColor(await client.getColor(interaction.guild.id))
              ],
              flags: 64
            });
          }
        }

        const button = new ButtonBuilder()
          .setLabel(label)
          .setStyle(style);

        if (style === 5) {
          button.setURL(embedId);
        } else {
          button.setCustomId(`send-${embedId}`);
        }

        if (emoji) button.setEmoji(emoji);

        let insertIndex = 0;
        let addedToExistingRow = false;

        for (let i = 0; i < components.length; i++) {
          const row = components[i];
          const isButtonRow = row.components.every(c => (c.type ?? c.data?.type) === 2);

          if (isButtonRow && row.components.length < 5) {
            const rebuiltRow = ActionRowBuilder.from(row).addComponents(button);
            components[i] = rebuiltRow;
            addedToExistingRow = true;
            break;
          }

          const firstComponent = row.components[0];
          if (
            firstComponent?.type === 3 ||
            firstComponent?.custom_id === "embed_editor" ||
            firstComponent?.customId === "embed_editor"
          ) {
            insertIndex = i;
            break;
          }

          insertIndex = i + 1;
        }

        if (!addedToExistingRow) {
          const newRow = new ActionRowBuilder().addComponents(button);
          components.splice(insertIndex, 0, newRow);
        }

        await working.message.edit({ components });
        working.message.components = components;
        workingEmbeds.set(interaction.user.id, working);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Added component!`)
              .setColor(await client.getColor(interaction.guild.id))
          ],
          flags: 64
        });
      }
      case "component_modal_add_menu": {
        const label = interaction.fields.getTextInputValue("input_menu_label");

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`menu_send-${Math.floor(Math.random() * 1e25).toString()}`)
          .setPlaceholder(label)
          .addOptions([
            {
              label: "Example Option",
              value: "example_value",
              description: "Automatically removed when adding selection"
            }
          ]);

        const menuRow = new ActionRowBuilder().addComponents(menu);

        let components = working.message.components || [];
        let insertIndex = components.length;

        const editorIndex = components.findIndex(row =>
          row.components.some(c => c.custom_id === "embed_editor" || c.customId === "embed_editor")
        );
        if (editorIndex !== -1) insertIndex = editorIndex;

        components.splice(insertIndex, 0, menuRow);

        await working.message.edit({ components });
        working.message.components = components;
        workingEmbeds.set(interaction.user.id, working);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Added component!`)
              .setColor(await client.getColor(interaction.guild.id))
          ],
          flags: 64
        });
      }
      default: {
        if (interaction.customId.startsWith("component_modal_edit_menu:")) {
          const [_, rowIndexStr, compIndexStr, optionValue, fieldToEdit] = interaction.customId.split(":");
          const rowIndex = parseInt(rowIndexStr, 10);
          const compIndex = parseInt(compIndexStr, 10);
          const newValue = interaction.fields.getTextInputValue("inputField");

          const working = workingEmbeds.get(interaction.user.id);
          if (!working || !working.message) {
            return interaction.reply({
              content: "Your session has expired.",
              ephemeral: true
            });
          }

          const components = working.message.components ?? [];

          const targetRow = components[rowIndex];
          if (!targetRow) {
            return interaction.reply({ content: "Could not find row.", ephemeral: true });
          }

          const targetComp = targetRow.components?.[compIndex];
          if (!targetComp || targetComp.data?.type !== 3) {
            return interaction.reply({ content: "Could not find the select menu to update.", ephemeral: true });
          }


          const rebuiltMenu = StringSelectMenuBuilder.from(targetComp);

          const updatedOptions = rebuiltMenu.options.map(opt => {
            const isMatch = opt.data.value === optionValue;
            const before = { ...opt.data };

            const builder = StringSelectMenuOptionBuilder.from(opt);

            if (isMatch) {
              if (fieldToEdit === "edit_label") builder.setLabel(newValue);
              if (fieldToEdit === "edit_description") builder.setDescription(newValue);
              if (fieldToEdit === "edit_emoji") builder.setEmoji(newValue);
              if (fieldToEdit === "edit_value") builder.setValue(`send-${newValue}`);

              const after = builder.data;
            }

            return builder;
          });

          rebuiltMenu.setOptions(updatedOptions);

          const updatedRow = new ActionRowBuilder().addComponents(rebuiltMenu);
          components[rowIndex] = updatedRow;

          await working.message.edit({ components });

          working.message.components = components;
          workingEmbeds.set(interaction.user.id, working);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Selection updated!`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        }


        else if (interaction.customId.startsWith("component_modal_edit:")) {
          const parts = interaction.customId.split(":");
          const action = parts[1];
          const rowIndex = parseInt(parts[2], 10);
          const compIndex = parseInt(parts[3], 10);

          const targetRow = components[rowIndex];
          const rawComponent = targetRow?.components?.[compIndex];

          if (!targetRow || !rawComponent) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Component not found`)
                  .setColor(await client.getColor(interaction.guild.id))
              ],
              flags: 64
            });
          }

          switch (action) {
            case "edit_menu_add_selection": {
              const label = interaction.fields.getTextInputValue("edit_input_label");
              const value = interaction.fields.getTextInputValue("edit_input_value");
              const description = interaction.fields.getTextInputValue("edit_input_description");

              const rebuilt = StringSelectMenuBuilder.from(rawComponent);

              const existingOptions = rebuilt.options ?? [];

              rebuilt.setOptions(
                existingOptions.filter(opt => {
                  const val = typeof opt.data?.value === "string" ? opt.data.value : "";
                  return val !== "example_value" && val !== `send-${value}`;
                })
              );

              rebuilt.addOptions({
                label,
                value: `send-${value}`,
                description: description || undefined
              });

              targetRow.components[compIndex] = rebuilt;

              await working.message.edit({ components });
              working.message.components = components;
              workingEmbeds.set(interaction.user.id, working);

              return interaction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Selection added to menu!`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64
              });
            }
          }

          const newValue = interaction.fields.getTextInputValue("edit_input");

          let rebuilt;
          const type = rawComponent.type ?? rawComponent.data?.type;
          if (type === 2) {
            rebuilt = ButtonBuilder.from(rawComponent);
          } else if (type === 3) {
            rebuilt = StringSelectMenuBuilder.from(rawComponent);
          } else {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Unsupported component type`)
                  .setColor(await client.getColor(interaction.guild.id))
              ],
              flags: 64
            });
          }

          switch (action) {
            case "edit_button_label":
              rebuilt.setLabel(newValue);
              break;
            case "edit_button_emoji":
            case "edit_button_id":
              rebuilt.setCustomId(`send-${newValue}`);
              break;
            case "edit_button_style": {
              const style = parseInt(newValue);
              if (![1, 2, 3, 4, 5].includes(style)) {
                return interaction.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid style`)
                      .setColor(await client.getColor(interaction.guild.id))
                  ],
                  flags: 64
                });
              }
              rebuilt.setStyle(style);
              break;
            }
            case "edit_menu_label":
              rebuilt.setPlaceholder(newValue);
              break;

            default:
              return interaction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Unsupported edit type`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64
              });
          }

          targetRow.components[compIndex] = rebuilt;

          await working.message.edit({ components });
          working.message.components = components;
          workingEmbeds.set(interaction.user.id, working);

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Component updated!`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        } else break;
      }
    }
  }

  const actionMenu = new StringSelectMenuBuilder()
    .setCustomId("component_action_menu")
    .setPlaceholder("Select an action...")
    .addOptions(
      {
        label: "Add Component",
        value: "add",
        description: "Add a new button or menu component",
      },
      {
        label: "Edit Component",
        value: "edit",
        description: "Edit an existing component",
      },
      {
        label: "Remove Component",
        value: "remove",
        description: "Remove an existing component",
      }
    );

  const backButton = new ButtonBuilder()
    .setCustomId("back_button")
    .setLabel("Back")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row1 = new ActionRowBuilder().addComponents(actionMenu);

  const msg = await interaction.reply({
    components: [row1],
    flags: 64,
    fetchReply: true,
  });

  const collector = msg.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id });

  let currentStep = 1;
  let selectedAction = null;

  collector.on("collect", async (select) => {
    switch (select.customId) {
      case "component_action_menu": {
        selectedAction = select.values[0];
        currentStep = 2;

        const updatedActionMenu = StringSelectMenuBuilder.from(select.component).setDisabled(true);
        const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

        const components = [
          new ActionRowBuilder().addComponents(updatedActionMenu),
        ];

        switch (selectedAction) {
          case "add": {
            const targetMenu = new StringSelectMenuBuilder()
              .setCustomId("component_target_menu")
              .setPlaceholder("Select what to add...")
              .setDisabled(false)
              .addOptions(
                {
                  label: "Add Button",
                  value: "add_button",
                  description: "Add a button component"
                },
                {
                  label: "Add Menu",
                  value: "add_menu",
                  description: "Add a select menu component"
                }
              );

            return await select.update({
              components: [
                new ActionRowBuilder().addComponents(updatedActionMenu),
                new ActionRowBuilder().addComponents(targetMenu),
                new ActionRowBuilder().addComponents(updatedBackButton),
              ],
            });
          }
          default: {
            const allRows = interaction.message.components || [];
            let editorRowIndex = allRows.findIndex(row =>
              row.components.some(c => c.custom_id === "embed_editor" || c.customId === "embed_editor")
            );

            if (editorRowIndex === -1) editorRowIndex = allRows.length;

            const targetOptions = [];

            for (let i = 0; i < editorRowIndex; i++) {
              const row = allRows[i];
              row.components.forEach((component, index) => {
                const label =
                  component.label ||
                  component.placeholder ||
                  component.custom_id ||
                  component.customId ||
                  `Component ${index + 1}`;

                targetOptions.push({
                  label: `${label} (Row ${i}, Index ${index})`,
                  value: `${i}:${index}`
                });
              });
            }

            const targetMenu = new StringSelectMenuBuilder()
              .setCustomId("component_target_menu")
              .setPlaceholder("Select a component to edit/remove")
              .setDisabled(targetOptions.length === 0)
              .addOptions(targetOptions.length ? targetOptions : [{
                label: "No valid components",
                value: "none",
                default: true
              }]);

            components.push(new ActionRowBuilder().addComponents(targetMenu));
            components.push(new ActionRowBuilder().addComponents(updatedBackButton));
          }
        }

        await select.update({
          components
        });
        break;
      }
      case "component_edit_menu": {
        const val = select.values[0];
        const [action, rowIndex, compIndex] = val.split(":");
        const working = workingEmbeds.get(select.user.id);

        if (!working) {
          return select.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${select.user}: Session expired`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        }

        const targetRow = working.message.components?.[rowIndex];
        const targetComponent = targetRow?.components?.[compIndex];

        if (!targetComponent) {
          return select.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${select.user}: Couldn't find that component`)
                .setColor(await client.getColor(interaction.guild.id))
            ],
            flags: 64
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`component_modal_edit:${action}:${rowIndex}:${compIndex}`)
          .setTitle("Edit Component");

        let input;

        switch (action) {
          case "edit_button_style":
            input = new TextInputBuilder()
              .setCustomId("edit_input")
              .setLabel("New Button Style (1–5)")
              .setStyle(TextInputStyle.Short)
              .setValue(targetComponent.style?.toString() || "")
              .setRequired(true);
            break;

          case "edit_button_label":
            input = new TextInputBuilder()
              .setCustomId("edit_input")
              .setLabel("New Button Label")
              .setStyle(TextInputStyle.Short)
              .setValue(targetComponent.label || "")
              .setRequired(true);
            break;

          case "edit_button_emoji":
            input = new TextInputBuilder()
              .setCustomId("edit_input")
              .setLabel("New Emoji")
              .setStyle(TextInputStyle.Short)
              .setValue(targetComponent.emoji?.name || "")
              .setRequired(false);
            break;

          case "edit_menu_label":
            input = new TextInputBuilder()
              .setCustomId("edit_input")
              .setLabel("New Placeholder")
              .setStyle(TextInputStyle.Short)
              .setValue(targetComponent.placeholder || "")
              .setRequired(true);
            break;

          case "edit_button_id":
            input = new TextInputBuilder()
              .setCustomId("edit_input")
              .setLabel("New Embed / Link / ID")
              .setStyle(TextInputStyle.Short)
              .setValue(targetComponent.customId || targetComponent.custom_id || targetComponent.url || "")
              .setRequired(true);
            break;

          case "edit_menu_add_selection": {
            const modal = new ModalBuilder()
              .setCustomId(`component_modal_edit:${action}:${rowIndex}:${compIndex}`)
              .setTitle("Add Menu Option");

            const labelInput = new TextInputBuilder()
              .setCustomId("edit_input_label")
              .setLabel("Option Label")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const valueInput = new TextInputBuilder()
              .setCustomId("edit_input_value")
              .setLabel("Option Value")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const descInput = new TextInputBuilder()
              .setCustomId("edit_input_description")
              .setLabel("Option Description (Optional)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false);

            return await select.showModal(
              modal.addComponents(
                new ActionRowBuilder().addComponents(labelInput),
                new ActionRowBuilder().addComponents(valueInput),
                new ActionRowBuilder().addComponents(descInput)
              )
            );
            break;
          }

          case "edit_menu_remove_selection": {
            currentStep = 4;
            lastEditRow = rowIndex;
            lastEditComp = compIndex;

            const rebuilt = StringSelectMenuBuilder.from(targetComponent);
            const existingOptions = rebuilt.options ?? [];

            if (existingOptions.length === 0) {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", select.guild.id)} ${select.user}: This menu has no selections to remove.`)
                    .setColor(await client.getColor(select.guild.id))
                ],
                flags: 64
              });
            }

            const removeMenu = new StringSelectMenuBuilder()
              .setCustomId(`menu_confirm_remove:${rowIndex}:${compIndex}`)
              .setPlaceholder("Select an option to remove")
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(
                existingOptions.map(opt => ({
                  label: opt.data?.label ?? "Unnamed",
                  value: opt.data?.value,
                  description: opt.data?.description
                }))
              );

            const frozenActionMenu = StringSelectMenuBuilder.from(actionMenu).setDisabled(true);
            const frozenTargetRow = ActionRowBuilder.from(select.message.components[1]);
            frozenTargetRow.components = frozenTargetRow.components.map(c => c.setDisabled(true));

            const editMenu = StringSelectMenuBuilder.from(select.message.components[2].components[0]).setDisabled(true);
            const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

            return await select.update({
              components: [
                new ActionRowBuilder().addComponents(frozenActionMenu),
                frozenTargetRow,
                new ActionRowBuilder().addComponents(editMenu),
                new ActionRowBuilder().addComponents(removeMenu),
                new ActionRowBuilder().addComponents(updatedBackButton)
              ]
            });
          }

          case "edit_menu_edit_selection": {
            currentStep = 4;
            lastEditRow = rowIndex;
            lastEditComp = compIndex;

            const rebuilt = StringSelectMenuBuilder.from(targetComponent);
            const existingOptions = rebuilt.options ?? [];

            if (existingOptions.length === 0) {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", select.guild.id)} ${select.user}: This menu has no selections to remove.`)
                    .setColor(await client.getColor(select.guild.id))
                ],
                flags: 64
              });
            }

            const removeMenu = new StringSelectMenuBuilder()
              .setCustomId(`menu_edit:${rowIndex}:${compIndex}`)
              .setPlaceholder("Select an option to edit")
              .addOptions(
                existingOptions.map(opt => ({
                  label: opt.data?.label ?? "Unnamed",
                  value: opt.data?.value,
                  description: opt.data?.description
                }))
              );

            const frozenActionMenu = StringSelectMenuBuilder.from(actionMenu).setDisabled(true);
            const frozenTargetRow = ActionRowBuilder.from(select.message.components[1]);
            frozenTargetRow.components = frozenTargetRow.components.map(c => c.setDisabled(true));

            const editMenu = StringSelectMenuBuilder.from(select.message.components[2].components[0]).setDisabled(true);
            const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

            return await select.update({
              components: [
                new ActionRowBuilder().addComponents(frozenActionMenu),
                frozenTargetRow,
                new ActionRowBuilder().addComponents(editMenu),
                new ActionRowBuilder().addComponents(removeMenu),
                new ActionRowBuilder().addComponents(updatedBackButton)
              ]
            });
          }


          default:
            return select.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${select.user}: Unsupported edit type`)
                  .setColor(await client.getColor(interaction.guild.id))
              ],
              flags: 64
            });
        }

        await select.showModal(modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        ));
        break;
      }
      case "component_target_menu": {
        const val = select.values[0];

        switch (val) {
          case "add_button": {
            const modal = new ModalBuilder()
              .setCustomId("component_modal_add_button")
              .setTitle("Add Button Component");

            const styleInput = new TextInputBuilder()
              .setCustomId("input_button_style")
              .setLabel("Button Style (1-5)")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const emojiInput = new TextInputBuilder()
              .setCustomId("input_button_emoji")
              .setLabel("Emoji (optional)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false);

            const embedInput = new TextInputBuilder()
              .setCustomId("input_button_embed")
              .setLabel("Embed / Link / ID")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const labelInput = new TextInputBuilder()
              .setCustomId("input_button_label")
              .setLabel("Button Label")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            await select.showModal(
              modal.addComponents(
                new ActionRowBuilder().addComponents(styleInput),
                new ActionRowBuilder().addComponents(emojiInput),
                new ActionRowBuilder().addComponents(embedInput),
                new ActionRowBuilder().addComponents(labelInput)
              )
            );
            break;
          }
          case "add_menu": {
            const modal = new ModalBuilder()
              .setCustomId("component_modal_add_menu")
              .setTitle("Add Menu Component");

            const labelInput = new TextInputBuilder()
              .setCustomId("input_menu_label")
              .setLabel("Menu Label")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            await select.showModal(
              modal.addComponents(
                new ActionRowBuilder().addComponents(labelInput)
              )
            );
            break;
          }
        }

        switch (selectedAction) {
          case "remove": {
            const [rowIndex, compIndex] = val.split(":").map(Number);
            const working = workingEmbeds.get(select.user.id);

            if (!working) return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
                  .setColor(await client.getColor(interaction.guild.id))
              ],
              flags: 64
            });

            const components = working.message.components || [];
            const targetRow = components[rowIndex];
            const targetComponent = targetRow?.components?.[compIndex];

            if (!targetRow || !targetComponent) {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Couldn't find component`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64,
              });
            }

            const response = await client.Assistant.ask(select, `${await client.getEmoji("warn", interaction.guild.id)} Are you sure you want to remove **${targetComponent.label || targetComponent.placeholder || "this component"}**?`)

            switch (response) {
              case true: {
                targetRow.components.splice(compIndex, 1);
                if (targetRow.components.length === 0) components.splice(rowIndex, 1);

                await working.message.edit({ components });
                working.message.components = components;
                workingEmbeds.set(select.user.id, working);

                return select.editReply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Removed component!`)
                      .setColor(await client.getColor(interaction.guild.id))
                  ],
                  flags: 64,
                });
              }
              case false: {
                return await select.deleteReply();
              }
            }
          }
          case "edit": {
            const [rowIndex, compIndex] = val.split(":").map(Number);
            const working = workingEmbeds.get(select.user.id);

            if (!working) {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${select.user}: Session expired`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64
              });
            }

            const targetRow = working.message.components?.[rowIndex];
            const targetComponent = targetRow?.components?.[compIndex];

            if (!targetComponent) {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${select.user}: Couldn't find that component`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64
              });
            }

            let options = [];
            if (targetComponent.type === 2) {
              options = [
                { label: "Label", value: `edit_button_label:${rowIndex}:${compIndex}` },
                { label: "Emoji", value: `edit_button_emoji:${rowIndex}:${compIndex}` },
                { label: "Custom ID / Link", value: `edit_button_id:${rowIndex}:${compIndex}` },
                { label: "Style", value: `edit_button_style:${rowIndex}:${compIndex}` },
              ];
            } else if (targetComponent.data?.type === 3 || targetComponent.type === 3 || targetComponent instanceof StringSelectMenuBuilder) {
              options = [
                { label: "Label", value: `edit_menu_label:${rowIndex}:${compIndex}` },
                { label: "Add selection", value: `edit_menu_add_selection:${rowIndex}:${compIndex}` },
                { label: "Edit selection", value: `edit_menu_edit_selection:${rowIndex}:${compIndex}` },
                { label: "Remove selection", value: `edit_menu_remove_selection:${rowIndex}:${compIndex}` },
              ];
            } else {
              return select.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("warn", interaction.guild.id)} ${select.user}: Component not supported`)
                    .setColor(await client.getColor(interaction.guild.id))
                ],
                flags: 64
              });
            }

            const editMenu = new StringSelectMenuBuilder()
              .setCustomId("component_edit_menu")
              .setPlaceholder("Choose what to edit...")
              .addOptions(options);

            const frozenActionRow = ActionRowBuilder.from(select.message.components[0]);
            frozenActionRow.components = frozenActionRow.components.map(c => c.setDisabled(true));

            const frozenTargetRow = ActionRowBuilder.from(select.message.components[1]);
            frozenTargetRow.components = frozenTargetRow.components.map(c => c.setDisabled(true));

            const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

            const updatedComponents = [
              frozenActionRow,
              frozenTargetRow,
              new ActionRowBuilder().addComponents(editMenu),
              new ActionRowBuilder().addComponents(updatedBackButton),
            ];

            currentStep = 3;

            return await select.update({
              components: updatedComponents
            });

          }
        }
        break;
      }
      case "back_button": {
        switch (currentStep) {
          case 2: {
            currentStep = 1;

            const resetActionMenu = StringSelectMenuBuilder.from(actionMenu).setDisabled(false);
            const disabledBack = ButtonBuilder.from(backButton).setDisabled(true);

            return await select.update({
              components: [
                new ActionRowBuilder().addComponents(resetActionMenu)
              ]
            });
          }
          case 3: {
            currentStep = 2;

            const frozenActionMenu = StringSelectMenuBuilder.from(actionMenu).setDisabled(true);
            const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

            const components = [
              new ActionRowBuilder().addComponents(frozenActionMenu)
            ];

            let restoredTargetMenu;

            if (selectedAction === "add") {
              restoredTargetMenu = new StringSelectMenuBuilder()
                .setCustomId("component_target_menu")
                .setPlaceholder("Select what to add...")
                .setDisabled(false)
                .addOptions(
                  {
                    label: "Add Button",
                    value: "add_button",
                    description: "Add a button component"
                  },
                  {
                    label: "Add Menu",
                    value: "add_menu",
                    description: "Add a select menu component"
                  }
                );
            } else {
              const working = workingEmbeds.get(interaction.user.id);
              const components = working?.message?.components || [];

              const editorRowIndex = components.findIndex(row =>
                row.components.some(c => c.custom_id === "embed_editor" || c.customId === "embed_editor")
              );

              const targetOptions = [];

              for (let i = 0; i < (editorRowIndex !== -1 ? editorRowIndex : components.length); i++) {
                const row = components[i];
                row.components.forEach((component, index) => {
                  const label =
                    component.label ||
                    component.placeholder ||
                    component.custom_id ||
                    component.customId ||
                    `Component ${index + 1}`;

                  targetOptions.push({
                    label: `${label} (Row ${i}, Index ${index})`,
                    value: `${i}:${index}`
                  });
                });
              }

              restoredTargetMenu = new StringSelectMenuBuilder()
                .setCustomId("component_target_menu")
                .setPlaceholder("Select a component to edit/remove")
                .setDisabled(targetOptions.length === 0)
                .addOptions(targetOptions.length ? targetOptions : [{
                  label: "No valid components",
                  value: "none",
                  default: true
                }]);
            }

            components.push(new ActionRowBuilder().addComponents(restoredTargetMenu));
            components.push(new ActionRowBuilder().addComponents(updatedBackButton));

            return await select.update({
              components
            });
            break;
          }
          case 4: {
            currentStep = 3;

            const working = workingEmbeds.get(interaction.user.id);
            const componentsArr = working?.message?.components || [];

            const frozenActionMenu = StringSelectMenuBuilder.from(actionMenu).setDisabled(true);

            const targetOptions = [];
            for (let i = 0; i < componentsArr.length; i++) {
              const row = componentsArr[i];
              row.components.forEach((component, index) => {
                const label =
                  component.label ||
                  component.placeholder ||
                  component.custom_id ||
                  component.customId ||
                  `Component ${index + 1}`;

                targetOptions.push({
                  label: `${label} (Row ${i}, Index ${index})`,
                  value: `${i}:${index}`
                });
              });
            }

            const restoredTargetMenu = new StringSelectMenuBuilder()
              .setCustomId("component_target_menu")
              .setPlaceholder("Select a component to edit/remove")
              .setDisabled(true)
              .addOptions(targetOptions.length ? targetOptions : [{
                label: "No valid components",
                value: "none",
                default: true
              }]);

            let restoredEditMenu = null;
            const targetRow = componentsArr?.[lastEditRow];
            const targetComponent = targetRow?.components?.[lastEditComp];

            if (targetComponent) {
              let options = [];
              if (targetComponent.type === 2) {
                options = [
                  { label: "Label", value: `edit_button_label:${lastEditRow}:${lastEditComp}` },
                  { label: "Emoji", value: `edit_button_emoji:${lastEditRow}:${lastEditComp}` },
                  { label: "Custom ID / Link", value: `edit_button_id:${lastEditRow}:${lastEditComp}` },
                  { label: "Style", value: `edit_button_style:${lastEditRow}:${lastEditComp}` },
                ];
              } else if (
                targetComponent.data?.type === 3 ||
                targetComponent.type === 3 ||
                targetComponent instanceof StringSelectMenuBuilder
              ) {
                options = [
                  { label: "Label", value: `edit_menu_label:${lastEditRow}:${lastEditComp}` },
                  { label: "Add selection", value: `edit_menu_add_selection:${lastEditRow}:${lastEditComp}` },
                  { label: "Edit selection", value: `edit_menu_edit_selection:${lastEditRow}:${lastEditComp}` },
                  { label: "Remove selection", value: `edit_menu_remove_selection:${lastEditRow}:${lastEditComp}` },
                ];
              }

              restoredEditMenu = new StringSelectMenuBuilder()
                .setCustomId("component_edit_menu")
                .setPlaceholder("Choose what to edit...")
                .setDisabled(false)
                .addOptions(options);
            }

            const updatedBackButton = ButtonBuilder.from(backButton).setDisabled(false);

            return await select.update({
              content: null,
              components: [
                new ActionRowBuilder().addComponents(frozenActionMenu),
                new ActionRowBuilder().addComponents(restoredTargetMenu),
                new ActionRowBuilder().addComponents(restoredEditMenu),
                new ActionRowBuilder().addComponents(updatedBackButton),
              ]
            });
          }


        }
      }
      default: {
        if (select.customId.startsWith("menu_confirm_remove:")) {
          const [_, rowIndexStr, compIndexStr] = select.customId.split(":");
          const rowIndex = parseInt(rowIndexStr, 10);
          const compIndex = parseInt(compIndexStr, 10);
          const valueToRemove = select.values[0];

          const response = await client.Assistant.ask(select, `${await client.getEmoji("warn", select.guild.id)} ${select.user}: Are you sure you want to remove this selection?`);

          switch (response) {
            case true: {

              const working = workingEmbeds.get(select.user.id);

              if (!working) {
                return select.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(`${await client.getEmoji("cross", select.guild.id)} ${select.user}: Session expired`)
                      .setColor(await client.getColor(select.guild.id))
                  ],
                  flags: 64
                });
              }

              const components = working.message.components || [];

              const targetRow = components[rowIndex];

              const targetComponent = targetRow?.components?.[compIndex];

              if (!targetComponent || !targetComponent.options) {
                return select.reply({
                  embeds: [
                    new EmbedBuilder()
                      .setDescription(`${await client.getEmoji("warn", select.guild.id)} ${select.user}: Could not find the target menu or its options.`)
                      .setColor(await client.getColor(select.guild.id))
                  ],
                  flags: 64
                });
              }

              const seen = new Set();
              let updatedOptions = [];

              for (const opt of targetComponent.options) {
                const value = opt.data?.value || opt.value;
                if (value === valueToRemove || seen.has(value)) continue;
                seen.add(value);

                updatedOptions.push(
                  new StringSelectMenuOptionBuilder()
                    .setLabel(opt.data?.label || opt.label)
                    .setValue(value)
                    .setDescription(opt.data?.description || opt.description || "")
                );
              }

              if (updatedOptions.length === 0) {
                updatedOptions.push(
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Example Option")
                    .setValue("example_value")
                    .setDescription("Automatically removed when adding selection")
                );
              }

              const rebuiltMenu = StringSelectMenuBuilder
                .from(targetComponent)
                .setOptions(updatedOptions);


              targetRow.components[compIndex] = rebuiltMenu;

              await working.message.edit({ components });

              working.message.components = components;
              workingEmbeds.set(select.user.id, working);

              return select.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`${await client.getEmoji("check", select.guild.id)} ${select.user}: Remove selection!`)
                    .setColor(await client.getColor(select.guild.id))
                ],
                components: []
              });
            }
            case false: {
              return await select.deleteReply();
            }
          }
        }
        if (select.customId.startsWith("menu_edit:")) {
          const [_, rowIndexStr, compIndexStr] = select.customId.split(":");
          const rowIndex = parseInt(rowIndexStr, 10);
          const compIndex = parseInt(compIndexStr, 10);
          const valueToEdit = select.values[0];

          const working = workingEmbeds.get(select.user.id);
          if (!working) {
            return select.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("cross", select.guild.id)} ${select.user}: Session expired`)
                  .setColor(await client.getColor(select.guild.id))
              ],
              flags: 64
            });
          }

          const allRows = working.message?.components ?? [];

          if (!allRows[rowIndex] || !allRows[rowIndex].components?.[compIndex]) {
            return select.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("warn", select.guild.id)} ${select.user}: Could not find the selected component to edit.`)
                  .setColor(await client.getColor(select.guild.id))
              ],
              flags: 64
            });
          }

          const targetComponent = allRows[rowIndex].components[compIndex];

          if (!targetComponent || !targetComponent.options) {
            return select.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`${await client.getEmoji("warn", select.guild.id)} ${select.user}: Could not find the selection.`)
                  .setColor(await client.getColor(select.guild.id))
              ],
              flags: 64
            });
          }

          const configMenu = new StringSelectMenuBuilder()
            .setCustomId(`menu_edit_config_select:${rowIndex}:${compIndex}:${valueToEdit}`)
            .setPlaceholder("What do you want to edit?")
            .addOptions([
              { label: "Label", value: "label" },
              { label: "Description", value: "description" },
              { label: "Emoji", value: "emoji" },
              { label: "Value", value: "value" }
            ]);

          const frozenRows = select.message.components.slice(0, 4).map(row => {
            const frozenRow = ActionRowBuilder.from(row);
            frozenRow.components = frozenRow.components.map(comp => {
              if (comp.data?.type === 3) {
                return StringSelectMenuBuilder.from(comp).setDisabled(true);
              }
              if (comp.data?.type === 2) {
                const frozenBtn = ButtonBuilder.from(comp).setDisabled(true);
                if (!frozenBtn.data.label && !frozenBtn.data.emoji) {
                  frozenBtn.setLabel("Button");
                }
                return frozenBtn;
              }
              return comp;
            });
            return frozenRow;
          });

          return await select.update({
            components: [
              ...frozenRows,
              new ActionRowBuilder().addComponents(configMenu)
            ]
          });
        }
        if (select.customId.startsWith("menu_edit_config_select:")) {
          const [_, rowIndexStr, compIndexStr, valueToEdit] = select.customId.split(":");
          const rowIndex = parseInt(rowIndexStr, 10);
          const compIndex = parseInt(compIndexStr, 10);

          const fieldToEdit = select.values[0]; 
          
          function createModal(title, inputLabel, customIdSuffix, style = TextInputStyle.Short) {
            const modal = new ModalBuilder()
              .setCustomId(`component_modal_edit_menu:${rowIndex}:${compIndex}:${valueToEdit}:${customIdSuffix}`)
              .setTitle(title);

            const input = new TextInputBuilder()
              .setCustomId("inputField")
              .setLabel(inputLabel)
              .setStyle(style)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return modal;
          }

          let modal;

          switch (fieldToEdit) {
            case "label":
              modal = createModal("Edit Label", "Label", "edit_label");
              break;
            case "description":
              modal = createModal("Edit Description", "Description", "edit_description", TextInputStyle.Paragraph);
              break;
            case "emoji":
              modal = createModal("Edit Emoji", "Emoji (Resolved)", "edit_emoji");
              break;
            case "value":
              modal = createModal("Edit Custom ID", "Embed / Custom ID", "edit_value");
              break;
            default:
              return select.reply({ content: "Invalid option selected.", ephemeral: true });
          }

          await select.showModal(modal);
        }
      }
    }
  });
}

async function handleEmbedSave(interaction) {
  const { client } = interaction;
  const working = workingEmbeds.get(interaction.user.id);

  if (!working) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  if (interaction.isButton()) {

    const modal = new ModalBuilder()
      .setCustomId("embed_save_modal")
      .setTitle("Save Embed");

    const filenameInput = new TextInputBuilder()
      .setCustomId("input_filename")
      .setLabel("Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(filenameInput));

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== "embed_save_modal") return;

    const filename = interaction.fields.getTextInputValue("input_filename");
    const safeFilename = filename.replace(/[^a-z0-9_\-]/gi, "").toLowerCase();

    if (!safeFilename) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid name`)
            .setColor(await client.getColor(interaction.guild.id))
        ],
        flags: 64
      });
    }

    const embedDataArray = working.message.embeds.map(e => e.toJSON());

    const allRows = working.message.components || [];

    const embedEditorIndex = allRows.findIndex(row =>
      row.components.some(comp =>
        comp.custom_id === "embed_editor" || comp.customId === "embed_editor"
      )
    );

    const relevantComponents = embedEditorIndex !== -1
      ? allRows.slice(0, embedEditorIndex)
      : allRows;

    const componentData = relevantComponents.map(row => ({
      type: 1,
      components: row.components.map(c => c.toJSON())
    }));

    const savePath = path.join(__dirname, "../Data/Embeds", safeFilename + ".json");
    fs.writeFileSync(savePath, JSON.stringify({
      embeds: embedDataArray,
      components: componentData
    }, null, 2), "utf-8");

    return await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Embed saved as \`${safeFilename}\`.`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

}

async function handleEmbedRestart(interaction) {
  const { client } = interaction;
  const working = workingEmbeds.get(interaction.user.id);

  if (!working) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  const response = await client.Assistant.ask(interaction, `${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Are you sure you want to restart?`)

  switch (response) {
    case true: {
      const newEmbed = new EmbedBuilder()
        .setDescription("Edit me!")
        .setColor(await client.getColor(interaction.guild.id));

      await working.message.edit({ embeds: [newEmbed] });

      working.message.embeds = [newEmbed];
      workingEmbeds.set(interaction.user.id, working);

      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Restarted embed.`)
            .setColor(await client.getColor(interaction.guild.id))
        ],
        flags: 64
      });
    }
    case false: {
      return await interaction.deleteReply()
    }
  }
}

async function handleEmbedCancel(interaction) {
  const { client } = interaction;
  const working = workingEmbeds.get(interaction.user.id);

  if (!working) return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Session expired`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });

  const response = await client.Assistant.ask(interaction, `${await client.getEmoji("warn", interaction.guild.id)} ${interaction.user}: Are you sure you want to cancel?`);

  switch (response) {
    case true: {
      await working.message.delete().catch(() => { });
      workingEmbeds.delete(interaction.user.id);

      return await interaction.deleteReply();
    }
    case false: {
      return await interaction.deleteReply();
    }
  }
}

async function handleSendEmbed(interaction) {
  const { client, channel } = interaction;
  const embedName = interaction.options.getString("name");

  if (!embedName || typeof embedName !== "string") return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid embed`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });

  const embedFilePath = path.join(__dirname, "../Data/Embeds", `${embedName}.json`);

  if (!fs.existsSync(embedFilePath)) return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid embed`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });

  const embedDataRaw = fs.readFileSync(embedFilePath, "utf-8");
  const embedData = JSON.parse(embedDataRaw);

  const embeds = (embedData.embeds || []).map(data => EmbedBuilder.from(data));
  if (!embeds.length) return interaction.editReply({ content: "No valid embeds found in file.", flags: 64 });

  let components = [];
  if (Array.isArray(embedData.components)) {
    const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder } = require("discord.js");

    components = embedData.components.map(row => {
      const actionRow = new ActionRowBuilder();
      for (const component of row.components) {
        if (component.type === 2) {
          actionRow.addComponents(ButtonBuilder.from(component));
        } else if (component.type === 3) {
          actionRow.addComponents(StringSelectMenuBuilder.from(component));
        }
      }
      return actionRow;
    });
  }

  await channel.send({ embeds, components });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Sent!`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });
}

async function handleEmbedRefresh(interaction) {
  const { client } = interaction;
  const messageInput = interaction.options.getString("message");
  const embedName = interaction.options.getString("name");

  const messageIdMatch = messageInput.match(/\d{17,19}/g);
  if (!messageIdMatch) return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid message ID or Link`)
        .setColor(await client.getColor(interaction.guild.id))
    ]
  });

  const messageId = messageIdMatch[messageIdMatch.length - 1];

  let targetMessage = null;

  for (const [, channel] of interaction.guild.channels.cache) {
    if (!channel.isTextBased()) continue;

    try {
      const msg = await channel.messages.fetch(messageId);
      if (msg) {
        targetMessage = msg;
        break;
      }
    } catch {

    }
  }

  if (!targetMessage) return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Couldn't find message.`)
        .setColor(await client.getColor(interaction.guild.id))
    ]
  });

  const embedValidate = new EmbedBuilder()
    .setDescription(`${await client.getEmoji("cross")} ${interaction.user}: Query did not meet validations.`)
    .setColor(await client.getColor(interaction.guild.id))

  if ((
    targetMessage.content && targetMessage.content.trim().length > 0 ||
    targetMessage.embeds.length === 0 && targetMessage.components.length === 0 ||
    // This one is for my ticket system so you can remove this.
    targetMessage.embeds[0]?.title?.startsWith("📩") ||
    targetMessage.author.id !== client.user.id
  )) return interaction.editReply({ embeds: [embedValidate] });

  const embedPath = path.join(__dirname, "../Data/Embeds", `${embedName}.json`);
  if (!fs.existsSync(embedPath)) return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Couldn't find \`${embedName}\``)
        .setColor(client.color.main)
    ]
  });

  const embedData = JSON.parse(fs.readFileSync(embedPath, "utf8"));

  const newEmbed = EmbedBuilder.from(embedData);

  await targetMessage.edit({
    embeds: [newEmbed],
    components: targetMessage.components,
    content: null
  });

  return await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${await client.getEmoji("check", interaction.guild.id)} ${interaction.user}: Updated embed!`)
        .setColor(await client.getColor(interaction.guild.id))
    ],
    flags: 64
  });
}

async function handleDisplayEmbed(interaction) {
  const { client } = interaction;
  const fs = require("fs").promises;
  const path = require("path");

  const idSource = interaction.isButton()
    ? interaction.customId
    : interaction.isStringSelectMenu()
      ? interaction.values?.[0]
      : null;

  const embedName = idSource?.replace(/^send-/, "");
  if (!embedName) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Invalid embed ID.`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  const filePath = path.join(__dirname, "../Data/Embeds", `${embedName}.json`);
  let embedFile;

  try {
    const raw = await fs.readFile(filePath, "utf8");
    embedFile = JSON.parse(raw);
  } catch (err) {
    const errorType = err.code === "ENOENT" ? "not found" : "malformed";
    console.log(err);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Embed file \`${embedName}.json\` ${errorType === "not found" ? "does not exist" : "is malformed"}.`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  const embedData = embedFile.embeds?.[0];
  if (!embedData) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Embed file \`${embedName}.json\` is missing an embed object.`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  if (!embedData.title && !embedData.description && (!embedData.fields || embedData.fields.length === 0)) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`${await client.getEmoji("cross", interaction.guild.id)} ${interaction.user}: Embed \`${embedName}.json\` is missing a title, description, or fields.`)
          .setColor(await client.getColor(interaction.guild.id))
      ],
      flags: 64
    });
  }

  const finalEmbed = EmbedBuilder.from(embedData);

  return interaction.reply({
    embeds: [finalEmbed],
    flags: 64,
    components: embedFile.components || []
  });
}


module.exports = {
  handleEditEmbed,
  handleSendEmbed,
  handleEmbedRefresh,
  handleEditFields,
  handleEditComponents,
  handleEmbedSave,
  handleEmbedRestart,
  handleEmbedCancel,
  handleDisplayEmbed,
  workingEmbeds,
};
