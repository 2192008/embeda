const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, ApplicationCommandOptionType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { workingEmbeds, handleEmbedRestart, handleEmbedCancel, handleEditFields, handleSendEmbed, handleEmbedRefresh, handleEditComponents } = require("../../Handlers/Embeds");

const fs = require('fs');
const path = require('path');

module.exports = {
    name: "embed",
    description: "Send or manage custom embeds.",
    cooldown: 1,
    prefix: {
        enabled: true
    },
    slash: {
        enabled: true,
        ephemeral: false,
        autoDefer: false,
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "create",
                description: "Create an embed"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "edit",
                description: "Edit an embed",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description: "Embed name",
                        required: true,
                        autocomplete: true
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "refresh",
                description: "Refresh an embed",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "message",
                        description: "Message ID or Link",
                        required: true,
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description: "Embed name",
                        required: true,
                        autocomplete: true
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "send",
                description: "Send a predefined embed",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description: "Embed name",
                        required: true,
                        autocomplete: true
                    }
                ]
            }
        ]
    },
    slashRun: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "send": {
                await interaction.deferReply({ flags: 64 })
                return await handleSendEmbed(interaction)
            }
            case "create": {
                await interaction.deferReply()

                const embed = new EmbedBuilder()
                    .setDescription("Edit me!")
                    .setColor(await client.getColor(interaction.guild.id));

                const controlButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("embed_save")
                        .setLabel("Save")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(await client.getEmoji("check", interaction.guild.id)),
                    new ButtonBuilder()
                        .setCustomId("embed_restart")
                        .setLabel("Restart")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(await client.getEmoji("warn", interaction.guild.id)),
                    new ButtonBuilder()
                        .setCustomId("embed_cancel")
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Danger)
                );

                const editOptions = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("embed_editor")
                        .setPlaceholder("Select what to edit...")
                        .addOptions(
                            {
                                label: "Author",
                                value: "author",
                                description: "Edit the author of the embed"
                            },
                            {
                                label: "URL",
                                value: "url",
                                description: "Edit the URL of the embed"
                            },
                            {
                                label: "Thumbnail",
                                value: "thumbnail",
                                description: "Set a thumbnail image"
                            },
                            {
                                label: "Title",
                                value: "title",
                                description: "Edit the title of the embed"
                            },
                            {
                                label: "Description",
                                value: "description",
                                description: "Edit the description of the embed"
                            },
                            {
                                label: "Fields",
                                value: "fields",
                                description: "Manage embed fields"
                            },
                            {
                                label: "Image",
                                value: "image",
                                description: "Edit the image of the embed"
                            },
                            {
                                label: "Color",
                                value: "color",
                                description: "Change the color of the embed"
                            },
                            {
                                label: "Footer",
                                value: "footer",
                                description: "Edit the footer text and icon"
                            },
                            {
                                label: "Timestamp",
                                value: "timestamp",
                                description: "Edit the timestamp"
                            },
                            {
                                label: "Components",
                                value: "components",
                                description: "Manage embed components"
                            }
                        )
                );

                const msg = await interaction.editReply({
                    embeds: [embed],
                    components: [editOptions, controlButtons],
                    fetchReply: true
                });

                workingEmbeds.set(interaction.user.id, {
                    member: interaction.member,
                    message: msg
                });

                const collector = msg.createMessageComponentCollector();

                collector.on("collect", async (i) => {
                    if (i.user.id !== interaction.user.id) return;

                    switch (i.customId) {
                        case "embed_restart":
                            return await handleEmbedRestart(i)
                        case "embed_cancel":
                            return await handleEmbedCancel(i)
                    }

                    if (i.values) {
                        const selected = i.values[0];

                        switch (selected) {
                            case "author": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_author`)
                                    .setTitle(`Edit Author`);

                                const name = new TextInputBuilder()
                                    .setCustomId(`input_author_name`)
                                    .setLabel(`Enter Name`)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMaxLength(256)
                                    .setRequired(false);

                                const icon = new TextInputBuilder()
                                    .setCustomId(`input_author_icon`)
                                    .setLabel(`Enter Icon URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(name),
                                        new ActionRowBuilder()
                                            .addComponents(icon)
                                    )
                                );
                                break;
                            }
                            case "url": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_url`)
                                    .setTitle(`Edit URL`);

                                const url = new TextInputBuilder()
                                    .setCustomId(`input_URL`)
                                    .setLabel(`Enter URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(url)
                                    )
                                );
                                break;
                            }
                            case "thumbnail": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_thumbnail`)
                                    .setTitle(`Edit Thumbnail URL`);

                                const thumbnail = new TextInputBuilder()
                                    .setCustomId(`input_thumbnail`)
                                    .setLabel(`Enter Thumbnail URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(thumbnail)
                                    )
                                );
                                break;
                            }
                            case "title": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_title`)
                                    .setTitle(`Edit Title`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_title`)
                                    .setLabel(`Enter Text`)
                                    .setMaxLength(256)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text)
                                    )
                                );
                                break;
                            }
                            case "description": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_description`)
                                    .setTitle(`Edit Description`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_description`)
                                    .setLabel(`Enter Text`)
                                    .setMaxLength(4000)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text)
                                    )
                                );
                                break;
                            }
                            case "fields": {
                                await handleEditFields(i);
                                break;
                            }
                            case "image": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_image`)
                                    .setTitle(`Edit Image`);

                                const url = new TextInputBuilder()
                                    .setCustomId(`input_image`)
                                    .setLabel(`Enter Image URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(url)
                                    )
                                );
                                break;
                            }
                            case "color": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_color`)
                                    .setTitle(`Edit Color`);

                                const color = new TextInputBuilder()
                                    .setCustomId(`input_color`)
                                    .setLabel(`Enter Color`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(color)
                                    )
                                );
                                break;
                            }
                            case "footer": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_footer`)
                                    .setTitle(`Edit Footer`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_footer_text`)
                                    .setLabel(`Enter Text`)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMaxLength(2048)
                                    .setRequired(false);

                                const icon = new TextInputBuilder()
                                    .setCustomId(`input_footer_icon`)
                                    .setLabel(`Enter Icon URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text),
                                        new ActionRowBuilder()
                                            .addComponents(icon)
                                    )
                                );
                                break;
                            }
                            case "timestamp": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_timestamp`)
                                    .setTitle(`Edit Timestamp`);

                                const timestamp = new TextInputBuilder()
                                    .setCustomId(`input_timestamp`)
                                    .setLabel(`Resolved`)
                                    .setPlaceholder("e.g., true or ms since 1970")
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(timestamp)
                                    )
                                );
                                break;
                            }
                            case "components": {
                                await handleEditComponents(i);
                                break;
                            }
                        }
                    }
                });
                break;
            }
            case "edit": {
                await interaction.deferReply();

                const embedName = interaction.options.getString("name");
                const embedFilePath = path.join(__dirname, "../../Data/Embeds", `${embedName}.json`);

                if (!fs.existsSync(embedFilePath)) return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`${await client.getEmoji("cross")} ${interaction.user}: Couldn't find \`${embedName}\``)
                            .setColor(client.color.main)
                    ]
                });

                const embedData = JSON.parse(fs.readFileSync(embedFilePath, "utf-8"));
                const embed = EmbedBuilder.from(embedData.embeds?.[0] || {});

                const controlButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("embed_save")
                        .setLabel("Save")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(await client.getEmoji("check", interaction.guild.id)),
                    new ButtonBuilder()
                        .setCustomId("embed_restart")
                        .setLabel("Restart")
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(await client.getEmoji("warn", interaction.guild.id)),
                    new ButtonBuilder()
                        .setCustomId("embed_cancel")
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Danger)
                );

                const editOptions = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("embed_editor")
                        .setPlaceholder("Select what to edit...")
                        .addOptions(
                            {
                                label: "Author",
                                value: "author",
                                description: "Edit the author of the embed"
                            },
                            {
                                label: "URL",
                                value: "url",
                                description: "Edit the URL of the embed"
                            },
                            {
                                label: "Thumbnail",
                                value: "thumbnail",
                                description: "Set a thumbnail image"
                            },
                            {
                                label: "Title",
                                value: "title",
                                description: "Edit the title of the embed"
                            },
                            {
                                label: "Description",
                                value: "description",
                                description: "Edit the description of the embed"
                            },
                            {
                                label: "Fields",
                                value: "fields",
                                description: "Manage embed fields"
                            },
                            {
                                label: "Image",
                                value: "image",
                                description: "Edit the image of the embed"
                            },
                            {
                                label: "Color",
                                value: "color",
                                description: "Change the color of the embed"
                            },
                            {
                                label: "Footer",
                                value: "footer",
                                description: "Edit the footer text and icon"
                            },
                            {
                                label: "Timestamp",
                                value: "timestamp",
                                description: "Edit the timestamp"
                            },
                            {
                                label: "Components",
                                value: "components",
                                description: "Manage embed components"
                            }
                        )
                );

                // Reconstruct saved components, if any
                let reconstructedComponents = [];
                if (Array.isArray(embedData.components)) {
                    const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder } = require("discord.js");

                    reconstructedComponents = embedData.components.map(row => {
                        const newRow = new ActionRowBuilder();
                        for (const comp of row.components) {
                            if (comp.type === 2) {
                                newRow.addComponents(ButtonBuilder.from(comp));
                            } else if (comp.type === 3) {
                                newRow.addComponents(StringSelectMenuBuilder.from(comp));
                            }
                        }
                        return newRow;
                    });
                }

                // Add saved components above the editor controls
                const msg = await interaction.editReply({
                    embeds: [embed],
                    components: [
                        ...reconstructedComponents,
                        editOptions,
                        controlButtons
                    ],
                    fetchReply: true
                });


                workingEmbeds.set(interaction.user.id, {
                    member: interaction.member,
                    message: msg,
                    embedName
                });

                const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id });

                collector.on("collect", async (i) => {
                    if (i.user.id !== interaction.user.id) return;

                    switch (i.customId) {
                        case "embed_restart":
                            return await handleEmbedRestart(i);
                        case "embed_cancel":
                            return await handleEmbedCancel(i);
                    }

                    if (i.isStringSelectMenu()) {
                        const selected = i.values[0];
                        switch (selected) {
                            case "author": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_author`)
                                    .setTitle(`Edit Author`);

                                const name = new TextInputBuilder()
                                    .setCustomId(`input_author_name`)
                                    .setLabel(`Enter Name`)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMaxLength(256)
                                    .setRequired(false);

                                const icon = new TextInputBuilder()
                                    .setCustomId(`input_author_icon`)
                                    .setLabel(`Enter Icon URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(name),
                                        new ActionRowBuilder()
                                            .addComponents(icon)
                                    )
                                );
                                break;
                            }
                            case "url": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_url`)
                                    .setTitle(`Edit URL`);

                                const url = new TextInputBuilder()
                                    .setCustomId(`input_URL`)
                                    .setLabel(`Enter URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(url)
                                    )
                                );
                                break;
                            }
                            case "thumbnail": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_thumbnail`)
                                    .setTitle(`Edit Thumbnail URL`);

                                const thumbnail = new TextInputBuilder()
                                    .setCustomId(`input_thumbnail`)
                                    .setLabel(`Enter Thumbnail URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(thumbnail)
                                    )
                                );
                                break;
                            }
                            case "title": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_title`)
                                    .setTitle(`Edit Title`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_title`)
                                    .setLabel(`Enter Text`)
                                    .setMaxLength(256)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text)
                                    )
                                );
                                break;
                            }
                            case "description": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_description`)
                                    .setTitle(`Edit Description`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_description`)
                                    .setLabel(`Enter Text`)
                                    .setMaxLength(4000)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text)
                                    )
                                );
                                break;
                            }
                            case "fields": {
                                await handleEditFields(i);
                                break;
                            }
                            case "image": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_image`)
                                    .setTitle(`Edit Image`);

                                const url = new TextInputBuilder()
                                    .setCustomId(`input_image`)
                                    .setLabel(`Enter Image URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(url)
                                    )
                                );
                                break;
                            }
                            case "color": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_color`)
                                    .setTitle(`Edit Color`);

                                const color = new TextInputBuilder()
                                    .setCustomId(`input_color`)
                                    .setLabel(`Enter Color`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(color)
                                    )
                                );
                                break;
                            }
                            case "footer": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_footer`)
                                    .setTitle(`Edit Footer`);

                                const text = new TextInputBuilder()
                                    .setCustomId(`input_footer_text`)
                                    .setLabel(`Enter Text`)
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMaxLength(2048)
                                    .setRequired(false);

                                const icon = new TextInputBuilder()
                                    .setCustomId(`input_footer_icon`)
                                    .setLabel(`Enter Icon URL`)
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(text),
                                        new ActionRowBuilder()
                                            .addComponents(icon)
                                    )
                                );
                                break;
                            }
                            case "timestamp": {
                                const modal = new ModalBuilder()
                                    .setCustomId(`embed_modal_timestamp`)
                                    .setTitle(`Edit Timestamp`);

                                const timestamp = new TextInputBuilder()
                                    .setCustomId(`input_timestamp`)
                                    .setLabel(`Resolved`)
                                    .setPlaceholder("e.g., true or ms since 1970")
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(false);

                                await i.showModal(
                                    modal.addComponents(
                                        new ActionRowBuilder()
                                            .addComponents(timestamp)
                                    )
                                );
                                break;
                            }
                            case "components": {
                                await handleEditComponents(i);
                                break;
                            }
                        }
                    }
                });

                collector.on("end", () => {
                    if (!msg.deleted) {
                        msg.edit({ components: [] }).catch(() => { });
                    }
                    workingEmbeds.delete(interaction.user.id);
                });

                break;
            }
            case "refresh": {
                await interaction.deferReply({ flags: 64 })
                return await handleEmbedRefresh(interaction)
            }
        }
    }
};
