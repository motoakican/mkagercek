import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';

const durationChoices = [
    { name: "5 dakika", value: 5 },
    { name: "10 dakika", value: 10 },
    { name: "30 dakika", value: 30 },
    { name: "1 saat", value: 60 },
    { name: "6 saat", value: 360 },
    { name: "1 gün", value: 1440 },
    { name: "1 hafta", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("sustur")
        .setDescription("Bir kullanıcıya belirli bir süre zaman aşımı uygular.")
        .addUserOption((option) =>
            option
                .setName("hedef")
                .setDescription("Zaman aşımı uygulanacak kullanıcı")
                .setRequired(true),
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName("sure")
                    .setDescription("Zaman aşımı süresi")
                    .setRequired(true)
                    .addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("sebep").setDescription("Zaman aşımı sebebi"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Susturma etkileşimi erteleme başarısız oldu`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sustur',
            });
            return;
        }

        const targetUser = interaction.options.getUser("hedef");
        const member = interaction.options.getMember("hedef");
        const durationMinutes = interaction.options.getInteger("sure");
        const reason = interaction.options.getString("sebep") || "Sebep belirtilmedi";

        if (!targetUser) {
            throw new TitanBotError(
                'Hedef kullanıcı eksik',
                ErrorTypes.USER_INPUT,
                'Zaman aşımı uygulanacak bir kullanıcı belirtmelisiniz.',
                { subtype: 'invalid_user' },
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Kendine zaman aşımı uygulayamaz",
                ErrorTypes.VALIDATION,
                "Kendinize zaman aşımı uygulayamazsınız.",
            );
        }
        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Bota zaman aşımı uygulayamaz",
                ErrorTypes.VALIDATION,
                "Bota zaman aşımı uygulayamazsınız.",
            );
        }
        if (!member) {
            throw new TitanBotError(
                "Hedef bulunamadı",
                ErrorTypes.USER_INPUT,
                "Hedef kullanıcı şu anda bu sunucuda bulunmuyor.",
            );
        }

        const durationMs = durationMinutes * 60 * 1000;
        const result = await ModerationService.timeoutUser({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
            durationMs,
            reason,
        });

        const durationDisplay =
            durationChoices.find((c) => c.value === durationMinutes)
                ?.name || `${durationMinutes} dakika`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `⏳ **${targetUser.tag}** adlı kullanıcı ${durationDisplay} süreyle susturuldu.`,
                    `**Sebep:** ${reason}\n**Vaka ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};