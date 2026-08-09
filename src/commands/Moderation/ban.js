import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("yasakla")
        .setDescription("Bir kullanıcıyı sunucudan yasaklar")
        .addUserOption((option) =>
            option
                .setName("hedef")
                .setDescription("Yasaklanacak kullanıcı")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("sebep").setDescription("Yasaklama sebebi"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const user = interaction.options.getUser("hedef");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

        if (!user) {
            throw new TitanBotError(
                'Hedef kullanıcı eksik',
                ErrorTypes.USER_INPUT,
                'Yasaklanacak bir kullanıcı belirtmelisiniz.',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === interaction.user.id) {
            throw new TitanBotError(
                'Kendini yasaklayamaz',
                ErrorTypes.VALIDATION,
                'Kendinizi yasaklayamazsınız.',
            );
        }
        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Botu yasaklayamaz',
                ErrorTypes.VALIDATION,
                'Botu yasaklayamazsınız.',
            );
        }

        const result = await ModerationService.banUser({
            guild: interaction.guild,
            user,
            moderator: interaction.member,
            reason,
        });

        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `🚫 **Yasaklandı:** ${user.tag}`,
                    `**Sebep:** ${reason}\n**Vaka ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};